import React, { useState, type ChangeEvent, useEffect } from 'react';
import api from '../services/api';
import { Grid, TextField } from '@mui/material';

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

  const genres = ["Pop", "Soul", "Rock", "Country", "RAP", "Afro / Dancehall", "Electronic", "Instrumental / Other"];
  
  const handleSubmit = async () => {
    setFormError(null);
    setUploadProgress(null);
    setUploadSuccess(false);

    // Simplified validation, no wallet checks needed
    if (!artistName.trim()) { setFormError('Please enter your artist name.'); return; }
    if (!trackTitle.trim()) { setFormError('Please enter a track title.'); return; }
    if (!genre) { setFormError('Please select a genre.'); return; }
    if (!artistWallet.trim() || !artistWallet.startsWith('0x')) { setFormError('Please enter a valid Polygon wallet address (starting with 0x).'); return; }
    if (!coverImageFile) { setFormError('Please select a cover image file.'); return; }
    if (!videoFile) { setFormError('Please select a video file.'); return; }
    if (!isOwnerConfirmed) { setFormError('Please confirm you own the rights.'); return; }
    
    setIsUploading(true);
    setUploadProgress('Uploading files to the server...');

    // Create FormData to send files and text to the backend
    const formData = new FormData();
    formData.append('artist', artistName);
    formData.append('title', trackTitle);
    formData.append('genre', genre);
    formData.append('artistWallet', artistWallet);
    formData.append('coverImageFile', coverImageFile);
    formData.append('videoFile', videoFile);

    try {
        const response = await api.post('/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
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
        }
    } catch (err: any) {
        const errorMsg = err.response?.data?.details || err.message || 'An error occurred during the upload process.';
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
