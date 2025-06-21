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
        const ffprobe = spawn(ffprobeStatic, [
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            filePath
        ]);

        let stdout = '';
        let stderr = '';

        ffprobe.stdout.on('data', (data) => {
            stdout += data.toString();
        });

        ffprobe.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        ffprobe.on('close', (code) => {
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

                const duration = parseFloat(metadata.format.duration);
                const width = videoStream.width;
                const height = videoStream.height;
                const bitrate = parseInt(metadata.format.bit_rate) || 0;
                const fps = eval(videoStream.r_frame_rate) || 30; // Convert fraction to decimal

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