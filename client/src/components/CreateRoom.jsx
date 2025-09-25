import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, CheckCircle } from 'lucide-react';
import './CreateRoom.css';

function CreateRoom({ user, setUser }) {
  const [instructorName, setInstructorName] = useState('');
  const [sessionName, setSessionName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!instructorName.trim() || !sessionName.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/create-room', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      const data = await response.json();
      setRoomCode(data.roomId);
      
      // Set user info
      setUser({
        name: instructorName,
        role: 'instructor',
        sessionName: sessionName
      });
    } catch (error) {
      console.error('Error creating room:', error);
      alert('Failed to create room. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const joinRoom = () => {
    navigate(`/room/${roomCode}`);
  };

  return (
    <div className="create-room-container">
      <button onClick={() => navigate('/')} className="back-button">
        <ArrowLeft size={20} />
        Back to Home
      </button>

      <div className="create-room-card">
        {!roomCode ? (
          <>
            <h1>Create New Session</h1>
            <p className="subtitle">Set up your virtual classroom</p>
            
            <form onSubmit={handleCreateRoom} className="create-form">
              <div className="form-group">
                <label htmlFor="instructorName">Instructor Name</label>
                <input
                  type="text"
                  id="instructorName"
                  value={instructorName}
                  onChange={(e) => setInstructorName(e.target.value)}
                  placeholder="Enter your name"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="sessionName">Session Name</label>
                <input
                  type="text"
                  id="sessionName"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="e.g., Mathematics 101 - Chapter 5"
                  required
                />
              </div>
              
              <button 
                type="submit" 
                className="create-button"
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Session'}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="success-icon">
              <CheckCircle size={64} color="#10b981" />
            </div>
            <h1>Session Created Successfully!</h1>
            <p className="subtitle">Share this code with your students</p>
            
            <div className="room-code-section">
              <div className="room-code-display">
                <span className="code-label">Room Code:</span>
                <span className="room-code">{roomCode}</span>
                <button 
                  onClick={copyToClipboard}
                  className="copy-button"
                  title="Copy to clipboard"
                >
                  <Copy size={20} />
                </button>
              </div>
              {copied && <span className="copied-message">Copied!</span>}
            </div>
            
            <div className="session-info">
              <div className="info-item">
                <strong>Instructor:</strong> {instructorName}
              </div>
              <div className="info-item">
                <strong>Session:</strong> {sessionName}
              </div>
            </div>
            
            <button onClick={joinRoom} className="join-button">
              Enter Classroom
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default CreateRoom;