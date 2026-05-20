import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import './SongBrowser.css';

export default function SongBrowser({ username, onSubmit }) {
  const [songs, setSongs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [year, setYear] = useState('');
  const [countries, setCountries] = useState([]);
  const [years, setYears] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(null);
  const [error, setError] = useState('');
  const [playingId, setPlayingId] = useState(null);
  const [toast, setToast] = useState('');
  const [toastType, setToastType] = useState('');
  const [mySubmittedSongIds, setMySubmittedSongIds] = useState(new Set());
  const [mySubmissionMap, setMySubmissionMap] = useState({}); // song_id -> submission_id

  const limit = 25;

  useEffect(() => {
    api.getCountries().then(setCountries);
    api.getYears().then(setYears);
  }, []);

  const loadMySubmissions = useCallback(async () => {
    if (!username) { setMySubmittedSongIds(new Set()); setMySubmissionMap({}); return; }
    try {
      const subs = await api.getMySubmissions(username);
      setMySubmittedSongIds(new Set(subs.map(s => s.song_id)));
      const map = {};
      subs.forEach(s => { map[s.song_id] = s.id; });
      setMySubmissionMap(map);
    } catch (e) { /* ignore */ }
  }, [username]);

  useEffect(() => {
    loadMySubmissions();
  }, [loadMySubmissions]);

  const loadSongs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit };
      if (search) params.search = search;
      if (country) params.country = country;
      if (year) params.year = year;
      const data = await api.getSongs(params);
      setSongs(data.songs);
      setTotal(data.total);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  }, [page, search, country, year]);

  useEffect(() => {
    loadSongs();
  }, [loadSongs]);

  const handleSubmit = async (songId) => {
    if (!username) {
      setError('Please enter your name first');
      return;
    }
    setSubmitting(songId);
    setError('');
    setToast('');
    try {
      await api.submitSong(songId, username);
      await loadMySubmissions();
      if (onSubmit) onSubmit();
      setToast('✅ Song submitted!');
      setToastType('success');
      setTimeout(() => { setToast(''); setToastType(''); }, 3000);
    } catch (e) {
      if (e.message.includes('already picked')) {
        setToast('😬 ' + e.message);
        setToastType('warning');
        setTimeout(() => { setToast(''); setToastType(''); }, 5000);
      } else if (e.message.includes('maximum reached')) {
        setToast('🚫 ' + e.message);
        setToastType('error');
        setTimeout(() => { setToast(''); setToastType(''); }, 4000);
      } else {
        setError(e.message);
      }
    }
    setSubmitting(null);
  };

  const handleRemove = async (songId) => {
    const subId = mySubmissionMap[songId];
    if (!subId) return;
    setSubmitting(songId);
    setError('');
    setToast('');
    try {
      await api.removeSubmission(subId, username);
      await loadMySubmissions();
      if (onSubmit) onSubmit();
      setToast('🗑️ Song removed.');
      setToastType('success');
      setTimeout(() => { setToast(''); setToastType(''); }, 3000);
    } catch (e) {
      setError(e.message);
    }
    setSubmitting(null);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="song-browser">
      <h2>🎵 Eurovision Song Catalog</h2>
      <p className="browse-hint">Browse and submit up to 2 songs. Submissions are anonymous — nobody else can see your picks.</p>
      <div className="filters">
        <input
          type="text"
          placeholder="Search by song or artist..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="search-input"
        />
        <select value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}>
          <option value="">All Countries</option>
          {countries.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select value={year} onChange={(e) => { setYear(e.target.value); setPage(1); }}>
          <option value="">All Years</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {toast && toastType === 'warning' && <div className="toast-backdrop" onClick={() => { setToast(''); setToastType(''); }} />}
      {toast && <div className={`toast-msg${toastType === 'warning' ? ' toast-warning' : toastType === 'error' ? ' toast-error' : ''}`}>{toast}</div>}
      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div className="loading">Loading songs...</div>
      ) : (
        <>
          <div className="song-count">{total} songs found</div>
          <div className="song-list">
            {songs.map((song) => (
              <div key={song.id} className="song-card">
                <div className="song-video-area">
                  {playingId === song.id ? (
                    <div className="song-embed">
                      <iframe
                        src={`https://www.youtube.com/embed/${getYoutubeId(song.youtube_url)}?autoplay=1`}
                        title={song.song}
                        allow="autoplay; encrypted-media"
                        allowFullScreen
                      />
                      <button className="close-video" onClick={() => setPlayingId(null)}>✕</button>
                    </div>
                  ) : (
                    <div className="song-thumbnail" onClick={() => setPlayingId(song.id)}>
                      <img
                        src={getYoutubeThumbnail(song.youtube_url)}
                        alt={song.song}
                        loading="lazy"
                      />
                      <span className="play-icon">▶</span>
                    </div>
                  )}
                </div>
                <div className="song-info">
                  <div className="song-meta">
                    <span className="song-year">{song.year}</span>
                    <span className="song-country">{getFlagEmoji(song.country)} {song.country}</span>
                  </div>
                  <div className="song-title">{song.song}</div>
                  <div className="song-artist">{song.artist}</div>
                  {(song.place_final || (song.points_final !== null && song.points_final !== undefined)) && (
                    <div className="song-place-points">
                      {song.place_final && <span className="song-place">#{song.place_final}</span>}
                      {song.points_final !== null && song.points_final !== undefined && <span className="song-points">{song.points_final} pts</span>}
                    </div>
                  )}
                </div>
                <div className="song-actions">
                  {mySubmittedSongIds.has(song.id) ? (
                    <button
                      className="your-pick-btn"
                      onClick={() => handleRemove(song.id)}
                      disabled={submitting === song.id}
                    >
                      {submitting === song.id ? 'Removing...' : '✓ Your pick'}
                    </button>
                  ) : (
                    <button
                      className="submit-btn"
                      onClick={() => handleSubmit(song.id)}
                      disabled={submitting === song.id || !username}
                    >
                      {submitting === song.id ? 'Submitting...' : '+ Submit'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pagination">
            <button disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
            <span>Page {page} of {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next →</button>
          </div>
        </>
      )}
    </div>
  );
}

function getYoutubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:v=|\/vi\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

function getYoutubeThumbnail(url) {
  const id = getYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

function getFlagEmoji(country) {
  const flags = {
    'Albania': '🇦🇱', 'Armenia': '🇦🇲', 'Australia': '🇦🇺', 'Austria': '🇦🇹',
    'Azerbaijan': '🇦🇿', 'Belarus': '🇧🇾', 'Belgium': '🇧🇪', 'Bosnia and Herzegovina': '🇧🇦',
    'Bosnia & Herzegovina': '🇧🇦',
    'Bulgaria': '🇧🇬', 'Croatia': '🇭🇷', 'Cyprus': '🇨🇾', 'Czech Republic': '🇨🇿',
    'Denmark': '🇩🇰', 'Estonia': '🇪🇪', 'Finland': '🇫🇮', 'France': '🇫🇷',
    'Georgia': '🇬🇪', 'Germany': '🇩🇪', 'Greece': '🇬🇷', 'Hungary': '🇭🇺',
    'Iceland': '🇮🇸', 'Ireland': '🇮🇪', 'Israel': '🇮🇱', 'Italy': '🇮🇹',
    'Latvia': '🇱🇻', 'Lithuania': '🇱🇹', 'Luxembourg': '🇱🇺', 'Malta': '🇲🇹',
    'Moldova': '🇲🇩', 'Monaco': '🇲🇨', 'Montenegro': '🇲🇪', 'Morocco': '🇲🇦',
    'Netherlands': '🇳🇱', 'North Macedonia': '🇲🇰', 'Norway': '🇳🇴',
    'Poland': '🇵🇱', 'Portugal': '🇵🇹', 'Romania': '🇷🇴', 'Russia': '🇷🇺',
    'San Marino': '🇸🇲', 'Serbia': '🇷🇸', 'Serbia and Montenegro': '🇷🇸',
    'Serbia & Montenegro': '🇷🇸', 'Slovakia': '🇸🇰',
    'Slovenia': '🇸🇮', 'Spain': '🇪🇸', 'Sweden': '🇸🇪', 'Switzerland': '🇨🇭',
    'Turkey': '🇹🇷', 'Ukraine': '🇺🇦', 'United Kingdom': '🇬🇧',
    'Yugoslavia': '🇷🇸', 'Czechia': '🇨🇿', 'F.Y.R. Macedonia': '🇲🇰',
  };
  return flags[country] || '🏳️';
}
