import { spawn } from 'child_process';
import ffprobeStatic from 'ffprobe-static';
import fs from 'fs';

export interface VideoMetadata {
    duration: number; // in seconds
    width: number;
    height: number;
    bitrate: number;
    fps: number;
}

export const getVideoMetadata = async (filePath: string): Promise<VideoMetadata> => {
    return new Promise((resolve, reject) => {
        console.log(`Starting ffprobe for file: ${filePath}`);
        console.log(`getVideoMetadata - filePath type: ${typeof filePath}`);
        console.log(`getVideoMetadata - filePath value: ${JSON.stringify(filePath)}`);
        
        // CRITICAL: Get the correct binary path from ffprobe-static
        const ffprobePath = ffprobeStatic.path;
        console.log(`ffprobePath extracted: ${ffprobePath}`);
        console.log(`ffprobePath type: ${typeof ffprobePath}`);
        
        // CRITICAL: Validate ffprobePath is a string
        if (typeof ffprobePath !== 'string') {
            console.error('CRITICAL ERROR: ffprobePath is not a string!', {
                type: typeof ffprobePath,
                value: ffprobePath,
                originalStatic: ffprobeStatic
            });
            return reject(new Error(`ffprobe binary path is not a string: ${typeof ffprobePath}`));
        }
        
        // CRITICAL: Validate filePath before using with spawn
        if (typeof filePath !== 'string') {
            console.error('CRITICAL ERROR in getVideoMetadata: filePath is not a string!', {
                type: typeof filePath,
                value: filePath
            });
            return reject(new Error(`Invalid file path type: expected string, got ${typeof filePath}`));
        }
        
        // FINAL SAFETY: Force string conversion and validate
        const finalPath = String(filePath).trim();
        if (!finalPath || finalPath === 'undefined' || finalPath === 'null') {
            console.error('CRITICAL ERROR: finalPath is invalid after conversion!', {
                original: filePath,
                converted: finalPath
            });
            return reject(new Error(`Invalid file path after conversion: ${finalPath}`));
        }
        
        console.log('Using final validated path with ffprobe:', finalPath);
        
        const ffprobe = spawn(ffprobePath, [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            finalPath
        ], {
            timeout: 30000 // 30 second timeout
        });

        let stdout = '';
        let stderr = '';

        ffprobe.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        ffprobe.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffprobe.on('close', (code) => {
            console.log(`ffprobe process closed with code: ${code}`);
            if (stderr) console.log(`ffprobe stderr: ${stderr}`);
            
            if (code !== 0) {
                reject(new Error(`ffprobe failed with code ${code}: ${stderr}`));
                return;
            }

            try {
                const metadata = JSON.parse(stdout);
                const videoStream = metadata.streams.find((stream: any) => stream.codec_type === 'video');
                
                if (!videoStream) {
                    reject(new Error('No video stream found in file'));
                    return;
                }

                // Parse duration with fallback
                let duration = parseFloat(metadata.format.duration);
                if (isNaN(duration) && videoStream.duration) {
                    duration = parseFloat(videoStream.duration);
                }
                if (isNaN(duration)) {
                    throw new Error('Could not determine video duration from metadata');
                }
                
                const width = videoStream.width || 0;
                const height = videoStream.height || 0;
                const bitrate = parseInt(metadata.format.bit_rate) || 0;
                
                // Safely parse frame rate (e.g., "30/1" -> 30, "25/1" -> 25)
                let fps = 30; // default
                if (videoStream.r_frame_rate && typeof videoStream.r_frame_rate === 'string') {
                    const parts = videoStream.r_frame_rate.split('/');
                    if (parts.length === 2) {
                        const numerator = parseInt(parts[0], 10);
                        const denominator = parseInt(parts[1], 10);
                        if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                            fps = numerator / denominator;
                        }
                    }
                }

                resolve({
                    duration,
                    width,
                    height,
                    bitrate,
                    fps
                });
            } catch (error) {
                reject(new Error(`Failed to parse ffprobe output: ${error instanceof Error ? error.message : 'Unknown error'}`));
            }
        });

        ffprobe.on('error', (error) => {
            reject(new Error(`Failed to spawn ffprobe: ${error.message}`));
        });
    });
};

export const validateVideoDuration = async (filePath: string, maxDurationSeconds: number = 120): Promise<{ valid: boolean; error?: string; duration?: number }> => {
    try {
        console.log(`Validating video duration for: ${filePath}`);
        
        // CRITICAL: Validate input parameter type
        if (typeof filePath !== 'string') {
            console.error('CRITICAL ERROR: filePath is not a string!', {
                type: typeof filePath,
                value: filePath
            });
            return {
                valid: false,
                error: `Invalid file path type: expected string, got ${typeof filePath}`
            };
        }
        
        if (!filePath || filePath.trim() === '') {
            return {
                valid: false,
                error: `Invalid file path: empty or null`
            };
        }
        
        // Verify file exists before processing
        console.log(`Checking if file exists: ${filePath}`);
        try {
            if (!fs.existsSync(filePath)) {
                return {
                    valid: false,
                    error: `Video file not found at path: ${filePath}`
                };
            }
        } catch (fsError) {
            console.error('fs.existsSync error:', fsError);
            return {
                valid: false,
                error: `File system error checking file existence: ${fsError instanceof Error ? fsError.message : 'Unknown error'}`
            };
        }
        
        console.log(`File exists, proceeding with metadata extraction`);
        
        const metadata = await getVideoMetadata(filePath);
        
        console.log(`Video metadata:`, {
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height,
            maxAllowed: maxDurationSeconds
        });
        
        if (metadata.duration > maxDurationSeconds) {
            return {
                valid: false,
                error: `Video duration ${metadata.duration.toFixed(2)} seconds exceeds maximum allowed ${maxDurationSeconds} seconds`,
                duration: metadata.duration
            };
        }
        
        return {
            valid: true,
            duration: metadata.duration
        };
        
    } catch (error) {
        console.error('Error validating video duration:', error);
        return {
            valid: false,
            error: `Failed to validate video duration: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}; 