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
  const [peerConnections, setPeerConnections] = useState({});
  const [activeScreenSharer, setActiveScreenSharer] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [showUserList, setShowUserList] = useState(false);
  const [screenShareSupported, setScreenShareSupported] = useState(false);
  
  const fileInputRef = useRef();
  const videoRef = useRef();
  const remoteVideoRef = useRef();
  const messagesEndRef = useRef();

  // Check screen share support on component mount
  useEffect(() => {
    const isSupported = navigator.mediaDevices && 
      navigator.mediaDevices.getDisplayMedia && 
      (window.isSecureContext || 
       location.hostname === 'localhost' || 
       location.hostname === '127.0.0.1');
    setScreenShareSupported(isSupported);
  }, []);

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
      console.log('📺 User started screen sharing:', userName);
      setActiveScreenSharer({ userId, userName });
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `${userName} started screen sharing`,
        sender: 'System',
        timestamp: new Date(),
        isSystem: true
      }]);
      
      // If this is not the current user, request to view the screen
      if (userId !== newSocket.id) {
        requestScreenShare(userId, newSocket);
      }
    });

    newSocket.on('user-stopped-screen-share', ({ userId, userName }) => {
      console.log('📺 User stopped screen sharing:', userName);
      setActiveScreenSharer(null);
      
      // Clean up peer connection
      if (peerConnections[userId]) {
        peerConnections[userId].close();
        setPeerConnections(prev => {
          const newPeers = { ...prev };
          delete newPeers[userId];
          return newPeers;
        });
      }
      
      // Clear remote video
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = null;
      }
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        text: `${userName} stopped screen sharing`,
        sender: 'System',
        timestamp: new Date(),
        isSystem: true
      }]);
    });

    // WebRTC signaling handlers
    newSocket.on('screen-share-offer', async ({ fromUserId, fromUserName, offer }) => {
      console.log('📡 Received screen share offer from:', fromUserName);
      await handleScreenShareOffer(fromUserId, offer, newSocket);
    });

    newSocket.on('screen-share-answer', async ({ fromUserId, answer }) => {
      console.log('📡 Received screen share answer from:', fromUserId);
      await handleScreenShareAnswer(fromUserId, answer);
    });

    newSocket.on('screen-share-ice-candidate', async ({ fromUserId, candidate }) => {
      console.log('📡 Received ICE candidate from:', fromUserId);
      await handleIceCandidate(fromUserId, candidate);
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
    console.log('🎬 Starting screen share process...');
    console.log('🔍 Current location:', window.location.href);
    console.log('🔒 Secure context:', window.isSecureContext);
    console.log('🌐 Protocol:', window.location.protocol);
    console.log('🏠 Hostname:', window.location.hostname);
    
    try {
      // Check if running on HTTPS or localhost
      const isSecureContext = window.isSecureContext || 
        location.hostname === 'localhost' || 
        location.hostname === '127.0.0.1';
      
      console.log('✅ Is secure context:', isSecureContext);
      
      if (!isSecureContext) {
        const message = 'Screen sharing requires HTTPS. Please access the site via HTTPS or use localhost for testing.';
        console.error('❌ Security error:', message);
        alert(message);
        return;
      }

      // Check if getDisplayMedia is supported
      console.log('🔍 Checking browser support...');
      console.log('📱 navigator.mediaDevices:', !!navigator.mediaDevices);
      console.log('🖥️ getDisplayMedia:', !!navigator.mediaDevices?.getDisplayMedia);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        const message = 'Screen sharing is not supported in this browser. Please use Chrome, Firefox, or Edge.';
        console.error('❌ Browser support error:', message);
        alert(message);
        return;
      }

      console.log('🚀 Requesting screen share permission...');
      
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          mediaSource: 'screen',
          width: { max: 1920 },
          height: { max: 1080 },
          frameRate: { max: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        }
      });

      console.log('✅ Screen share permission granted!');
      console.log('📺 Stream info:', {
        id: stream.id,
        videoTracks: stream.getVideoTracks().length,
        audioTracks: stream.getAudioTracks().length
      });

      setScreenStream(stream);
      setIsScreenSharing(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('📺 Video element updated with stream');
      }

      socket.emit('start-screen-share', {
        roomId: roomId,
        streamId: stream.id
      });
      console.log('📡 Screen share event sent to server');
      
      // Set as active screen sharer
      setActiveScreenSharer({ userId: socket.id, userName: user.name });

      // Handle stream end (user clicks "Stop sharing" in browser)
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        console.log('📺 Video track ended');
        stopScreenShare();
      });
      
      // Add audio track ended listener if audio is included
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length > 0) {
        audioTracks[0].addEventListener('ended', () => {
          console.log('🔊 Audio track ended');
          stopScreenShare();
        });
      }
    } catch (error) {
      console.error('❌ Screen share error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      
      let errorMessage = 'Could not start screen sharing. ';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = '🚫 Permission denied! Please click "Allow" when your browser asks to share your screen. You might need to:';
        errorMessage += '\n\n1. 🔄 Refresh the page and try again';
        errorMessage += '\n2. 🔒 Check if you blocked permissions in browser settings';
        errorMessage += '\n3. 🖥️ Make sure no other app is using screen capture';
        errorMessage += '\n4. 🌐 Try a different browser (Chrome recommended)';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '🔍 No screen capture source available. Please ensure:';
        errorMessage += '\n\n1. 📺 You have a display connected';
        errorMessage += '\n2. 🖱️ Click the correct screen/window when prompted';
        errorMessage += '\n3. 🔄 Try again';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = '❌ Screen sharing is not supported in this browser. Please use Chrome, Firefox, or Edge.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = '🔒 Screen capture source is already in use by another application. Please:';
        errorMessage += '\n\n1. 📱 Close other video conferencing apps';
        errorMessage += '\n2. 🖥️ Close other screen recording software';
        errorMessage += '\n3. 🔄 Try again';
      } else if (error.name === 'OverconstrainedError') {
        errorMessage = '⚙️ Screen capture settings are not supported. This is usually a browser issue.';
      } else if (error.name === 'AbortError') {
        errorMessage = '✋ Screen sharing was cancelled. Click "Share Screen" to try again.';
      } else {
        errorMessage += `\n\nTechnical details: ${error.name} - ${error.message}`;
        errorMessage += '\n\n🔧 Try these steps:';
        errorMessage += '\n1. 🔄 Refresh the page';
        errorMessage += '\n2. 🌐 Use Chrome browser';
        errorMessage += '\n3. 🔒 Grant permissions when asked';
        errorMessage += '\n4. 🖥️ Make sure localhost:5000 is trusted';
      }
      
      alert(errorMessage);
    }
  };

  const startSimpleScreenShare = async () => {
    console.log('🛠️ Trying simple screen share...');
    try {
      // Simplest possible request - just video, no audio, minimal constraints
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true
      });

      console.log('✅ Simple screen share worked!');
      setScreenStream(stream);
      setIsScreenSharing(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      socket.emit('start-screen-share', {
        roomId: roomId,
        streamId: stream.id
      });
      
      // Set as active screen sharer
      setActiveScreenSharer({ userId: socket.id, userName: user.name });

      // Handle stream end
      stream.getVideoTracks()[0].addEventListener('ended', () => {
        stopScreenShare();
      });
    } catch (error) {
      console.error('❌ Simple screen share also failed:', error);
      alert(`Simple screen share failed too: ${error.name} - ${error.message}\n\nPlease check browser console for more details.`);
    }
  };

  const testBrowserSupport = () => {
    const info = {
      userAgent: navigator.userAgent,
      location: window.location.href,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
      isSecureContext: window.isSecureContext,
      hasMediaDevices: !!navigator.mediaDevices,
      hasGetDisplayMedia: !!navigator.mediaDevices?.getDisplayMedia,
      permissions: navigator.permissions ? 'Available' : 'Not available'
    };
    
    console.log('🔍 Browser Support Test:', info);
    
    let message = '🔍 Browser Support Information:\n\n';
    message += `Browser: ${navigator.userAgent.split(' ')[0]}\n`;
    message += `URL: ${window.location.href}\n`;
    message += `Protocol: ${window.location.protocol}\n`;
    message += `Secure Context: ${window.isSecureContext}\n`;
    message += `Media Devices: ${!!navigator.mediaDevices}\n`;
    message += `Screen Share API: ${!!navigator.mediaDevices?.getDisplayMedia}\n`;
    message += `Permissions API: ${navigator.permissions ? 'Available' : 'Not available'}\n\n`;
    
    if (!navigator.mediaDevices?.getDisplayMedia) {
      message += '❌ Screen sharing is not supported in this browser!\n';
      message += 'Try using Chrome, Firefox, or Edge.';
    } else if (!window.isSecureContext && window.location.hostname !== 'localhost') {
      message += '⚠️ Screen sharing requires HTTPS!\n';
      message += 'Deploy to a cloud platform or use localhost.';
    } else {
      message += '✅ Your browser should support screen sharing!';
    }
    
    alert(message);
  };

  // WebRTC Configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Request to view someone's screen share
  const requestScreenShare = async (userId, socket) => {
    try {
      console.log('📡 Requesting screen share from:', userId);
      
      const peerConnection = new RTCPeerConnection(rtcConfig);
      
      // Handle incoming stream
      peerConnection.ontrack = (event) => {
        console.log('📺 Received remote screen stream');
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('screen-share-ice-candidate', {
            roomId: roomId,
            targetUserId: userId,
            candidate: event.candidate
          });
        }
      };
      
      // Store peer connection
      setPeerConnections(prev => ({ ...prev, [userId]: peerConnection }));
      
      // Create offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      // Send offer to screen sharer
      socket.emit('screen-share-offer', {
        roomId: roomId,
        targetUserId: userId,
        offer: offer
      });
    } catch (error) {
      console.error('❌ Error requesting screen share:', error);
    }
  };

  // Handle screen share offer (for the person sharing)
  const handleScreenShareOffer = async (fromUserId, offer, socket) => {
    try {
      console.log('📡 Handling screen share offer from:', fromUserId);
      
      const peerConnection = new RTCPeerConnection(rtcConfig);
      
      // Add screen stream to peer connection
      if (screenStream) {
        screenStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, screenStream);
        });
      }
      
      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('screen-share-ice-candidate', {
            roomId: roomId,
            targetUserId: fromUserId,
            candidate: event.candidate
          });
        }
      };
      
      // Store peer connection
      setPeerConnections(prev => ({ ...prev, [fromUserId]: peerConnection }));
      
      // Set remote description and create answer
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      // Send answer back
      socket.emit('screen-share-answer', {
        roomId: roomId,
        targetUserId: fromUserId,
        answer: answer
      });
    } catch (error) {
      console.error('❌ Error handling screen share offer:', error);
    }
  };

  // Handle screen share answer (for the person viewing)
  const handleScreenShareAnswer = async (fromUserId, answer) => {
    try {
      console.log('📡 Handling screen share answer from:', fromUserId);
      
      const peerConnection = peerConnections[fromUserId];
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
      }
    } catch (error) {
      console.error('❌ Error handling screen share answer:', error);
    }
  };

  // Handle ICE candidates
  const handleIceCandidate = async (fromUserId, candidate) => {
    try {
      const peerConnection = peerConnections[fromUserId];
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('❌ Error handling ICE candidate:', error);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    setActiveScreenSharer(null);
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    // Close all peer connections
    Object.values(peerConnections).forEach(pc => pc.close());
    setPeerConnections({});

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
          ) : activeScreenSharer ? (
            <div className="screen-share-viewer">
              <div className="screen-share-header">
                <span>{activeScreenSharer.userName} is sharing their screen</span>
              </div>
              <video ref={remoteVideoRef} autoPlay className="screen-video" />
            </div>
          ) : (
            <div className="screen-share-placeholder">
              <Monitor size={48} />
              <h3>No screen sharing active</h3>
              <p>Start sharing your screen to show content to others</p>
              
              {!screenShareSupported && (
                <div className="requirements-info">
                  <h4>Screen Sharing Requirements:</h4>
                  <ul>
                    <li>✅ Use Chrome, Firefox, or Edge browser</li>
                    <li>✅ Access via HTTPS or localhost</li>
                    <li>✅ Grant permission when prompted</li>
                    <li>✅ Ensure no other app is capturing screen</li>
                  </ul>
                </div>
              )}
              
              {screenShareSupported ? (
                <div className="screen-share-controls">
                  <button onClick={startScreenShare} className="start-share-btn">
                    <Monitor size={20} />
                    Share Screen
                  </button>
                  <button onClick={startSimpleScreenShare} className="start-share-btn-simple">
                    <Monitor size={20} />
                    Simple Share (Fallback)
                  </button>
                  <button onClick={testBrowserSupport} className="test-button">
                    🔍 Test Browser Support
                  </button>
                </div>
              ) : (
                <div className="screen-share-unsupported">
                  <button disabled className="start-share-btn disabled">
                    <Monitor size={20} />
                    Screen Share Unavailable
                  </button>
                  <p className="support-message">
                    {!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1' 
                      ? 'Screen sharing requires HTTPS connection'
                      : 'Screen sharing not supported in this browser'}
                  </p>
                </div>
              )}
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