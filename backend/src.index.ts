// ... existing code ...
    } catch (error) {
        console.error('Error updating submission status:', error);
        res.status(500).json({ error: 'Failed to update submission status.' });
    }
});

// New endpoint to delete a submission
app.delete('/submissions/:id', async (req: express.Request, res: express.Response): Promise<void> => {
    const { id } = req.params;

    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db = JSON.parse(dbData);

        const initialLength = db.tracks.length;
        db.tracks = db.tracks.filter((track: Track) => track.id !== id);

        if (db.tracks.length === initialLength) {
            res.status(404).json({ error: 'Track not found to delete.' });
            return;
        }

        await fs.writeFile(dbPath, JSON.stringify(db, null, 2));
        
        console.log(`Successfully deleted track ${id}`);

        res.status(200).json({ message: 'Track successfully deleted.' });

    } catch (error) {
        console.error('Error deleting submission:', error);
        res.status(500).json({ error: 'Failed to delete submission.' });
    }
});

// New endpoint to get submission stats
app.get('/stats', async (req: express.Request, res: express.Response) => {
    try {
        const dbData = await fs.readFile(dbPath, 'utf-8');
        const db = JSON.parse(dbData);
        const tracks = db.tracks as Track[];

        const totalSubmissions = tracks.length;
        const pending = tracks.filter(t => t.status === 'pending').length;
        const approved = tracks.filter(t => t.status === 'approved').length;
        const rejected = tracks.filter(t => t.status === 'rejected').length;

        res.status(200).json({
            totalSubmissions,
            pending,
            approved,
            rejected
        });

    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats.' });
    }
});


app.listen(port, () => {
  console.log(`Backend server is running on http://localhost:${port}`);
}); 