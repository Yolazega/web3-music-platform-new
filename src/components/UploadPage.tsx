import React, { useState, type ChangeEvent, useEffect } from 'react';
import api from '../services/api';

const UploadPage: React.FC = () => {
  // Removed all wagmi hooks (useAccount, useWriteContract, etc.)

  const [artistName, setArtistName] = useState<string>('');
  const [trackTitle, setTrackTitle] = useState<string>('');
  const [genre, setGenre] = useState<string>('');
  const [artistWallet, setArtistWallet] = useState<string>('');
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [isOwnerConfirmed, setIsOwnerConfirmed] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadSuccess, setUploadSuccess] = useState<boolean>(false);

  const genres = [
    "Pop", 
    "Soul", 
    "Rock", 
    "Country", 
    "RAP", 
    "Afro / Dancehall", 
    "Electronic", 
    "Instrumental / Other"
  ];
  
  // Enhanced file validation
  const validateFile = (file: File, type: 'image' | 'video'): { valid: boolean; error?: string } => {
    if (type === 'image') {
      const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif'];
      const maxImageSize = 10 * 1024 * 1024; // 10MB
      
      if (!allowedImageTypes.includes(file.type)) {
        return { valid: false, error: 'Invalid image format. Please use JPEG, PNG, or GIF.' };
      }
      if (file.size > maxImageSize) {
        return { valid: false, error: 'Image file too large. Maximum size is 10MB.' };
      }
      if (file.size < 1024) {
        return { valid: false, error: 'Image file too small. Minimum size is 1KB.' };
      }
    } else {
      const allowedVideoTypes = ['video/mp4', 'video/quicktime'];
      const maxVideoSize = 30 * 1024 * 1024; // 30MB for 90-second videos
      
      if (!allowedVideoTypes.includes(file.type)) {
        return { valid: false, error: 'Invalid video format. Please use MP4 or MOV.' };
      }
      if (file.size > maxVideoSize) {
        return { valid: false, error: 'Video file too large. Maximum size is 30MB for 90-second videos.' };
      }
      if (file.size < 10240) {
        return { valid: false, error: 'Video file too small. Minimum size is 10KB.' };
      }
    }

    if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
      return { valid: false, error: 'Invalid file name. Please rename your file.' };
    }

    return { valid: true };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validation = validateFile(file, type);
    if (!validation.valid) {
      setFormError(validation.error || 'Invalid file');
      e.target.value = '';
      return;
    }

    if (type === 'image') {
      setCoverImageFile(file);
    } else {
      setVideoFile(file);
    }
    setFormError(null);
  };

  const handleSubmit = async () => {
    setFormError(null);
    setUploadProgress(null);
    setUploadSuccess(false);

    // Enhanced validation
    if (!artistName.trim() || artistName.trim().length < 2) {
      setFormError('Artist name must be at least 2 characters long.');
      return;
    }
    if (!trackTitle.trim() || trackTitle.trim().length < 2) {
      setFormError('Track title must be at least 2 characters long.');
      return;
    }
    if (!genre || !genres.includes(genre)) {
      setFormError('Please select a valid genre.');
      return;
    }
    if (!artistWallet.trim() || !artistWallet.startsWith('0x') || artistWallet.length !== 42) {
      setFormError('Please enter a valid Polygon wallet address (42 characters starting with 0x).');
      return;
    }
    if (!coverImageFile) {
      setFormError('Please select a cover image file.');
      return;
    }
    if (!videoFile) {
      setFormError('Please select a video file.');
      return;
    }
    if (!isOwnerConfirmed) {
      setFormError('Please confirm you own the rights.');
      return;
    }

    // Final file validation
    const imageValidation = validateFile(coverImageFile, 'image');
    if (!imageValidation.valid) {
      setFormError(`Cover image: ${imageValidation.error}`);
      return;
    }

    const videoValidation = validateFile(videoFile, 'video');
    if (!videoValidation.valid) {
      setFormError(`Video: ${videoValidation.error}`);
      return;
    }
    
    setIsUploading(true);
    setUploadProgress('Preparing files for upload...');

    const formData = new FormData();
    formData.append('artist', artistName.trim());
    formData.append('title', trackTitle.trim());
    formData.append('genre', genre);
    formData.append('artistWallet', artistWallet.trim());
    formData.append('coverImageFile', coverImageFile);
    formData.append('videoFile', videoFile);

    try {
        setUploadProgress('Uploading files to IPFS... This may take several minutes for large files.');
        
        const response = await api.post('/upload', formData, {
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setUploadProgress(`Uploading... ${percentCompleted}% complete`);
            }
          }
        });

        if (response.status === 201) {
            setUploadProgress('Upload complete! Your track is being processed.');
            setUploadSuccess(true);
            
            // Reset form
            setArtistName('');
            setTrackTitle('');
            setGenre('');
            setArtistWallet('');
            setCoverImageFile(null);
            setVideoFile(null);
            setIsOwnerConfirmed(false);
            
            // Clear file inputs
            const imageInput = document.getElementById('coverImageFile') as HTMLInputElement;
            const videoInput = document.getElementById('videoFile') as HTMLInputElement;
            if (imageInput) imageInput.value = '';
            if (videoInput) videoInput.value = '';
        }
    } catch (err: unknown) {
        console.error('Upload error:', err);
        const error = err as { 
          response?: { data?: { error?: string }; status?: number }; 
          message?: string; 
          code?: string 
        };
        
        let errorMsg = 'An error occurred during the upload process.';
        
        if (error.code === 'ECONNABORTED') {
          errorMsg = 'Upload timeout. Files may be too large or connection is slow.';
        } else if (error.response?.status === 413) {
          errorMsg = 'Files are too large. Please reduce file sizes and try again.';
        } else if (error.response?.status === 429) {
          errorMsg = 'Too many upload attempts. Please wait 15 minutes before trying again.';
        } else if (error.response?.data?.error) {
          errorMsg = error.response.data.error;
        } else if (error.message) {
          errorMsg = error.message;
        }
        
        setFormError(errorMsg);
        setUploadProgress(null);
    } finally {
        setIsUploading(false);
    }
  };

  useEffect(() => {
    // Clean up effect, can be used for other things later
  }, []);
  
  const isButtonDisabled = isUploading || !isOwnerConfirmed;

  // No more wallet connection checks needed here
  
  return (
    <div>
      <h2>Register as an Artist & Upload Your First Track</h2>
      <p>Upload your track here. Our team will review it and add it to the blockchain for voting.</p>
      
      {uploadProgress && <p><i>Status: {uploadProgress}</i></p>}
      {uploadSuccess && <p style={{ color: 'green' }}>Success! Your track has been submitted for review.</p>}
      
      {formError && (
        <p style={{ color: 'red' }}>
            Error: {formError}
        </p>
      )}

      <div style={{ margin: '20px 0' }}>
        <label htmlFor="artistName">Your Artist Name:</label><br />
        <input 
            type="text" 
            id="artistName" 
            value={artistName} 
            onChange={(e) => setArtistName(e.target.value)} 
            placeholder="e.g., The Weekend" 
            disabled={isUploading} 
            style={{width: '300px'}}
        />
      </div>

      <div style={{ margin: '20px 0' }}>
        <label htmlFor="artistWallet">Your Wallet Address (Polygon):</label><br />
        <input 
            type="text" 
            id="artistWallet" 
            value={artistWallet} 
            onChange={(e) => setArtistWallet(e.target.value)} 
            placeholder="0x..." 
            disabled={isUploading} 
            style={{width: '300px'}}
        />
        <p><small>Your wallet address is needed to uniquely identify your song for the voting process. Please ensure it's correct.</small></p>
      </div>

      <div style={{ margin: '20px 0' }}>
        <label htmlFor="trackTitle">Track Title:</label><br />
        <input 
            type="text" 
            id="trackTitle" 
            value={trackTitle} 
            onChange={(e) => setTrackTitle(e.target.value)} 
            placeholder="e.g., Blinding Lights" 
            disabled={isUploading} 
            style={{width: '300px'}} 
        />
      </div>
      
      <div style={{ margin: '20px 0' }}>
        <label htmlFor="genre">Genre:</label><br />
        <select 
            id="genre" 
            value={genre} 
            onChange={(e) => setGenre(e.target.value)}
            disabled={isUploading}
            style={{width: '310px', padding: '5px'}}
        >
            <option value="" disabled>Select a genre</option>
            {genres.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div style={{ margin: '20px 0' }}>
        <label htmlFor="coverImageFile">Cover Image (e.g., JPG, PNG):</label><br />
        <input 
            type="file" 
            id="coverImageFile" 
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCoverImageFile(e.target.files ? e.target.files[0] : null)} 
            accept="image/*" 
            disabled={isUploading} 
        />
      </div>
      
       <div style={{ margin: '20px 0' }}>
        <label htmlFor="videoFile">Video File (e.g., MP4, MOV):</label><br />
        <input 
            type="file" 
            id="videoFile" 
            onChange={(e: ChangeEvent<HTMLInputElement>) => setVideoFile(e.target.files ? e.target.files[0] : null)} 
            accept="video/mp4,video/quicktime,.mov" 
            disabled={isUploading} 
        />
      </div>

      <div style={{ margin: '20px 0' }}>
        <input 
            type="checkbox" 
            id="isOwnerConfirmed" 
            checked={isOwnerConfirmed} 
            onChange={(e) => setIsOwnerConfirmed(e.target.checked)} 
            disabled={isUploading} 
        />
        <label htmlFor="isOwnerConfirmed" style={{ marginLeft: '5px' }}>
            I confirm I own the rights or have permission to upload this music and artwork.
        </label>
      </div>

      <button onClick={handleSubmit} disabled={isButtonDisabled}>
        {isUploading ? 'Uploading...' : 'Submit Track for Review'}
      </button>
    </div>
  );
};

export default UploadPage;
