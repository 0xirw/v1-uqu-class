import { Link } from 'react-router-dom';
import { Users, Plus } from 'lucide-react';
import './Home.css';

function Home() {
  return (
    <div className="home-container">
      <div className="hero-section">
        <h1 className="app-title">ColApp</h1>
        <h2 className="app-subtitle">Interactive Virtual Classroom Platform</h2>
        <p className="app-description">
          Connect students and instructors in real-time virtual sessions with 
          chat, file sharing, and screen sharing capabilities.
        </p>
      </div>
      
      <div className="action-cards">
        <Link to="/create-room" className="card instructor-card">
          <Plus className="card-icon" size={48} />
          <h3>I'm an Instructor</h3>
          <p>Create a new virtual classroom session</p>
          <span className="card-button">Create Room</span>
        </Link>
        
        <Link to="/join-room" className="card student-card">
          <Users className="card-icon" size={48} />
          <h3>I'm a Student</h3>
          <p>Join an existing classroom session</p>
          <span className="card-button">Join Room</span>
        </Link>
      </div>
      
      <div className="features-section">
        <h3>Platform Features</h3>
        <div className="features-grid">
          <div className="feature">
            <h4>💬 Real-time Chat</h4>
            <p>Instant messaging for all participants</p>
          </div>
          <div className="feature">
            <h4>📁 File Sharing</h4>
            <p>Share documents, images, and presentations</p>
          </div>
          <div className="feature">
            <h4>🖥️ Screen Sharing</h4>
            <p>Share your screen for interactive lessons</p>
          </div>
          <div className="feature">
            <h4>🔒 Secure Rooms</h4>
            <p>6-character codes for session security</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;