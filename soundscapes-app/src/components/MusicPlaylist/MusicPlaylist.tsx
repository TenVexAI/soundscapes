import React from 'react';
import { ChevronDown, ChevronRight, Star, Play, ListPlus, ListStart, Shuffle, X } from 'lucide-react';
import { usePlaylistStore } from '../../stores/playlistStore';
import { MusicTrack } from '../../types';

interface TrackItemProps {
  track: MusicTrack;
  isFavorite: boolean;
  onPlay: () => void;
  onAddToQueue: () => void;
  onPlayNext: () => void;
  onToggleFavorite: () => void;
}

const TrackItem: React.FC<TrackItemProps> = ({
  track,
  isFavorite,
  onPlay,
  onAddToQueue,
  onPlayNext,
  onToggleFavorite,
}) => (
  <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-bg-secondary/50 group">
    <button
      onClick={onToggleFavorite}
      className={`p-1 rounded ${isFavorite ? 'text-yellow-400' : 'text-text-secondary opacity-0 group-hover:opacity-100'} hover:text-yellow-400 transition-all`}
      title="Toggle favorite"
    >
      <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
    </button>
    
    <div className="flex-1 min-w-0">
      <p className="text-sm text-text-primary truncate">{track.title}</p>
      <p className="text-xs text-text-secondary truncate">{track.artist}</p>
    </div>
    
    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      <button
        onClick={onAddToQueue}
        className="p-1.5 rounded text-text-secondary hover:text-accent-cyan hover:bg-bg-secondary"
        title="Add to queue"
      >
        <ListPlus size={16} />
      </button>
      <button
        onClick={onPlayNext}
        className="p-1.5 rounded text-text-secondary hover:text-accent-green hover:bg-bg-secondary"
        title="Play next"
      >
        <ListStart size={16} />
      </button>
      <button
        onClick={onPlay}
        className="p-1.5 rounded text-text-secondary hover:text-accent-purple hover:bg-bg-secondary"
        title="Play now"
      >
        <Play size={16} />
      </button>
    </div>
  </div>
);

export const MusicPlaylist: React.FC = () => {
  const {
    albums,
    queue,
    isShuffled,
    favorites,
    playTrack,
    addToQueue,
    playTrackNext,
    removeFromQueue,
    clearQueue,
    toggleShuffle,
    toggleFavorite,
  } = usePlaylistStore();

  const [expandedAlbums, setExpandedAlbums] = React.useState<Set<string>>(new Set());

  const toggleAlbum = (albumName: string) => {
    const newExpanded = new Set(expandedAlbums);
    if (newExpanded.has(albumName)) {
      newExpanded.delete(albumName);
    } else {
      newExpanded.add(albumName);
    }
    setExpandedAlbums(newExpanded);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-text-primary">Music Library</h2>
        <button
          onClick={toggleShuffle}
          className={`p-2 rounded-lg transition-colors ${
            isShuffled ? 'bg-accent-purple text-bg-primary' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'
          }`}
          title="Toggle shuffle"
        >
          <Shuffle size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {albums.map((album) => (
          <div key={album.name} className="mb-2">
            <button
              onClick={() => toggleAlbum(album.name)}
              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-bg-secondary transition-colors"
            >
              {expandedAlbums.has(album.name) ? (
                <ChevronDown size={20} className="text-text-secondary" />
              ) : (
                <ChevronRight size={20} className="text-text-secondary" />
              )}
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-text-primary">{album.name}</p>
                <p className="text-xs text-text-secondary">
                  {album.artist} • {album.tracks.length} tracks
                </p>
              </div>
            </button>
            
            {expandedAlbums.has(album.name) && (
              <div className="ml-6 mt-1 space-y-0.5">
                {album.tracks.map((track) => {
                  const fullTrack: MusicTrack = {
                    ...track,
                    album: album.name,
                    albumPath: album.path,
                    favorite: favorites.has(track.id),
                  };
                  
                  return (
                    <TrackItem
                      key={track.id}
                      track={fullTrack}
                      isFavorite={favorites.has(track.id)}
                      onPlay={() => playTrack(fullTrack)}
                      onAddToQueue={() => addToQueue(fullTrack)}
                      onPlayNext={() => playTrackNext(fullTrack)}
                      onToggleFavorite={() => toggleFavorite(track.id)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {queue.length > 0 && (
        <div className="border-t border-border p-2">
          <div className="flex items-center justify-between mb-2 px-2">
            <h3 className="text-sm font-medium text-text-secondary">Queue ({queue.length})</h3>
            <button
              onClick={clearQueue}
              className="text-xs text-text-secondary hover:text-red-400 transition-colors"
            >
              Clear
            </button>
          </div>
          <div className="max-h-32 overflow-y-auto space-y-1">
            {queue.map((track, index) => (
              <div
                key={`${track.id}-${index}`}
                className="flex items-center gap-2 p-2 rounded-lg bg-bg-secondary/30"
              >
                <span className="text-xs text-text-secondary w-4">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{track.title}</p>
                </div>
                <button
                  onClick={() => removeFromQueue(index)}
                  className="p-1 text-text-secondary hover:text-red-400"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
