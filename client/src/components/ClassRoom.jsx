import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import { 
  LogOut, 
  Users, 
  MessageSquare, 
  Share, 
  Monitor, 
  MonitorOff,
  Send,
  Paperclip,
  Download,
  X
} from 'lucide-react';
import './ClassRoom.css';

function ClassRoom({ user }) {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [userList, setUserList] = useState([]);
  const [files, setFiles] = useState([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteScreenStreams, setRemoteScreenStreams] = useState({});
  const [activeTab, setActiveTab] = useState('chat');
  const [showUserList, setShowUserList] = useState(false);
  
  const fileInputRef = useRef();
  const videoRef = useRef();
  const messagesEndRef = useRef();

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    // Initialize socket connection
    const newSocket = io();
    setSocket(newSocket);

    // Join the room
    newSocket.emit('join-room', {
      roomId: roomId,
      userName: user.name,
      role: user.role
    });

    // Listen for room history
    newSocket.on('room-history', ({ messages, files }) => {
      setMessages(messages);
      setFiles(files);
    });

    // Listen for new messages
    newSocket.on('receive-message', (message) => {
      setMessages(prev => [...prev, message]);
    });

    // Listen for new files
    newSocket.on('receive-file', (file) => {
      setFiles(prev => [...prev, file]);
    });

    // Listen for user list updates
    newSocket.on('user-list', (users) => {
      setUserList(users);
    });

    // Listen for user events
    newSocket.on('user-joined', ({ userName, role }) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `${userName} (${role}) joined the session`,
        sender: 'System',
        timestamp: new Date(),
        isSystem: true
      }]);
    });

    newSocket.on('user-left', ({ userName }) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `${userName} left the session`,
        sender: 'System',
        timestamp: new Date(),
        isSystem: true
      }]);
    });

    // Listen for screen sharing events
    newSocket.on('user-started-screen-share', ({ userId, userName, streamId }) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `${userName} started screen sharing`,
        sender: 'System',
        timestamp: new Date(),
        isSystem: true
      }]);
    });

    newSocket.on('user-stopped-screen-share', ({ userId, userName }) => {
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `${userName} stopped screen sharing`,
        sender: 'System',
        timestamp: new Date(),
        isSystem: true
      }]);
    });

    // Listen for errors
    newSocket.on('error', (message) => {
      alert(message);
      navigate('/');
    });

    return () => {
      newSocket.disconnect();
    };
  }, [roomId, user, navigate]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !socket) return;

    socket.emit('send-message', {
      roomId: roomId,
      message: newMessage,
      sender: user.name
    });

    setNewMessage('');
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const fileData = {
        name: file.name,
        type: file.type,
        size: file.size,
        data: event.target.result
      };

      socket.emit('share-file', {
        roomId: roomId,
        fileData: fileData,
        sender: user.name
      });
    };

    reader.readAsDataURL(file);
  };

  const downloadFile = (file) => {
    const link = document.createElement('a');
    link.href = file.data;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      setScreenStream(stream);
      setIsScreenSharing(true);
      videoRef.current.srcObject = stream;

      socket.emit('start-screen-share', {
        roomId: roomId,
        streamId: stream.id
      });

      // Handle stream end
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });
    } catch (error) {
      console.error('Error starting screen share:', error);
      alert('Could not start screen sharing. Please check your browser permissions.');
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    socket.emit('stop-screen-share', {
      roomId: roomId
    });
  };

  const leaveRoom = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }
    navigate('/');
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="classroom-container">
      {/* Header */}
      <div className="classroom-header">
        <div className="header-left">
          <h1 className="room-title">
            {user.sessionName || `Room ${roomId}`}
          </h1>
          <span className="room-code">Code: {roomId}</span>
        </div>
        
        <div className="header-right">
          <button 
            className="user-list-toggle"
            onClick={() => setShowUserList(!showUserList)}
          >
            <Users size={20} />
            <span>{userList.length}</span>
          </button>
          
          <button className="leave-button" onClick={leaveRoom}>
            <LogOut size={20} />
            Leave
          </button>
        </div>
      </div>

      <div className="classroom-main">
        {/* Screen Sharing Area */}
        <div className="screen-share-area">
          {isScreenSharing ? (
            <div className="screen-share-active">
              <div className="screen-share-header">
                <span>You are sharing your screen</span>
                <button onClick={stopScreenShare} className="stop-share-btn">
                  <MonitorOff size={20} />
                  Stop Sharing
                </button>
              </div>
              <video ref={videoRef} autoPlay muted className="screen-video" />
            </div>
          ) : (
            <div className="screen-share-placeholder">
              <Monitor size={48} />
              <h3>No screen sharing active</h3>
              <p>Start sharing your screen to show content to others</p>
              <button onClick={startScreenShare} className="start-share-btn">
                <Monitor size={20} />
                Share Screen
              </button>
            </div>
          )}
        </div>

        {/* Side Panel */}
        <div className="side-panel">
          {/* Tabs */}
          <div className="panel-tabs">
            <button 
              className={`tab ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare size={20} />
              Chat
            </button>
            <button 
              className={`tab ${activeTab === 'files' ? 'active' : ''}`}
              onClick={() => setActiveTab('files')}
            >
              <Share size={20} />
              Files
            </button>
          </div>

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="chat-container">
              <div className="messages-container">
                {messages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`message ${message.isSystem ? 'system' : ''} ${message.sender === user.name ? 'own' : ''}`}
                  >
                    {!message.isSystem && (
                      <div className="message-header">
                        <span className="sender">{message.sender}</span>
                        <span className="time">{formatTime(message.timestamp)}</span>
                      </div>
                    )}
                    <div className="message-text">{message.text}</div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              
              <form onSubmit={sendMessage} className="message-form">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="message-input"
                />
                <button type="submit" className="send-button">
                  <Send size={20} />
                </button>
              </form>
            </div>
          )}

          {/* Files Tab */}
          {activeTab === 'files' && (
            <div className="files-container">
              <div className="files-header">
                <h3>Shared Files</h3>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="upload-button"
                >
                  <Paperclip size={20} />
                  Upload
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.jpeg,.png,.gif"
                />
              </div>
              
              <div className="files-list">
                {files.map((file) => (
                  <div key={file.id} className="file-item">
                    <div className="file-info">
                      <div className="file-name">{file.name}</div>
                      <div className="file-meta">
                        <span>{formatFileSize(file.size)}</span>
                        <span>•</span>
                        <span>{file.sender}</span>
                        <span>•</span>
                        <span>{formatTime(file.timestamp)}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => downloadFile(file)}
                      className="download-button"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                ))}
                {files.length === 0 && (
                  <div className="no-files">
                    <Share size={48} />
                    <p>No files shared yet</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User List Modal */}
      {showUserList && (
        <div className="modal-overlay" onClick={() => setShowUserList(false)}>
          <div className="user-list-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Participants ({userList.length})</h3>
              <button onClick={() => setShowUserList(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="user-list">
              {userList.map((user, index) => (
                <div key={index} className="user-item">
                  <div className="user-avatar">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="user-info">
                    <div className="user-name">{user.name}</div>
                    <div className="user-role">{user.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ClassRoom;