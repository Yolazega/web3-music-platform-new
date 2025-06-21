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
        console.log(`Using ffprobe binary: ${ffprobeStatic}`);
        
        const ffprobe = spawn(ffprobeStatic, [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            filePath
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
        
        // Verify file exists before processing
        if (!fs.existsSync(filePath)) {
            return {
                valid: false,
                error: `Video file not found at path: ${filePath}`
            };
        }
        
        const metadata = await getVideoMetadata(filePath);
        
        console.log(`Video metadata:`, {
            duration: metadata.duration,
            width: metadata.width,
            height: metadata.height,
            bitrate: metadata.bitrate,
            fps: metadata.fps
        });

        if (metadata.duration > maxDurationSeconds) {
            return {
                valid: false,
                error: `Video duration is ${Math.round(metadata.duration)}s. Maximum allowed is ${maxDurationSeconds}s (2 minutes).`,
                duration: metadata.duration
            };
        }

        return {
            valid: true,
            duration: metadata.duration
        };
    } catch (error) {
        console.error('Video duration validation error:', error);
        return {
            valid: false,
            error: `Failed to validate video duration: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}; 