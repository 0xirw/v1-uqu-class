import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Users } from 'lucide-react';
import './JoinRoom.css';

function JoinRoom({ user, setUser }) {
  const [studentName, setStudentName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!studentName.trim() || !roomCode.trim()) return;

    setIsJoining(true);
    setError('');

    try {
      // Check if room exists
      const response = await fetch(`/api/room/${roomCode.toUpperCase()}`);
      const data = await response.json();

      if (!data.exists) {
        setError('Room not found. Please check the code and try again.');
        setIsJoining(false);
        return;
      }

      // Set user info
      setUser({
        name: studentName,
        role: 'student'
      });

      // Navigate to room
      navigate(`/room/${roomCode.toUpperCase()}`);
    } catch (error) {
      console.error('Error joining room:', error);
      setError('Failed to join room. Please try again.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleCodeChange = (e) => {
    const value = e.target.value.toUpperCase().slice(0, 6);
    setRoomCode(value);
    setError('');
  };

  return (
    <div className="join-room-container">
      <button onClick={() => navigate('/')} className="back-button">
        <ArrowLeft size={20} />
        Back to Home
      </button>

      <div className="join-room-card">
        <div className="icon-container">
          <Users size={64} color="#3b82f6" />
        </div>
        
        <h1>Join Session</h1>
        <p className="subtitle">Enter the session code provided by your instructor</p>
        
        <form onSubmit={handleJoinRoom} className="join-form">
          <div className="form-group">
            <label htmlFor="studentName">Your Name</label>
            <input
              type="text"
              id="studentName"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Enter your name"
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="roomCode">Session Code</label>
            <input
              type="text"
              id="roomCode"
              value={roomCode}
              onChange={handleCodeChange}
              placeholder="Enter 6-character code"
              className={`code-input ${error ? 'error' : ''}`}
              maxLength="6"
              required
            />
            <div className="code-format-hint">
              Code format: 6 characters (letters and numbers)
            </div>
          </div>
          
          {error && <div className="error-message">{error}</div>}
          
          <button 
            type="submit" 
            className="join-button"
            disabled={isJoining || roomCode.length !== 6}
          >
            {isJoining ? 'Joining...' : 'Join Session'}
          </button>
        </form>
        
        <div className="help-section">
          <h3>Need help?</h3>
          <ul>
            <li>Ask your instructor for the 6-character session code</li>
            <li>Make sure you enter the code exactly as provided</li>
            <li>Codes are case-insensitive</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default JoinRoom;