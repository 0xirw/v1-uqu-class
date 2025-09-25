const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket', 'polling']
});

// Store rooms and their data
const rooms = new Map();

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static files from the React app build
app.use(express.static(path.join(__dirname, 'client/dist')));

// API endpoint to create a new room
app.post('/api/create-room', (req, res) => {
  const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
  const roomData = {
    id: roomId,
    instructor: null,
    students: [],
    messages: [],
    files: []
  };
  
  rooms.set(roomId, roomData);
  console.log(`Room created: ${roomId}`);
  res.json({ roomId });
});

// API endpoint to check if room exists
app.get('/api/room/:roomId', (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId.toUpperCase());
  
  if (room) {
    res.json({ exists: true });
  } else {
    res.json({ exists: false });
  }
});

// Handle socket connections
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a room
  socket.on('join-room', ({ roomId, userName, role }) => {
    const room = rooms.get(roomId.toUpperCase());
    
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }
    
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userName = userName;
    socket.role = role;
    
    // Add user to room
    if (role === 'instructor') {
      room.instructor = { id: socket.id, name: userName };
    } else {
      room.students.push({ id: socket.id, name: userName });
    }
    
    // Notify others in the room about the new user
    socket.to(roomId).emit('user-joined', { userName, role });
    
    // Send room history to the new user
    socket.emit('room-history', {
      messages: room.messages,
      files: room.files
    });
    
    // Send updated user list
    const userList = [];
    if (room.instructor) {
      userList.push({ name: room.instructor.name, role: 'instructor' });
    }
    room.students.forEach(student => {
      userList.push({ name: student.name, role: 'student' });
    });
    
    io.to(roomId).emit('user-list', userList);
  });

  // Handle chat messages
  socket.on('send-message', ({ roomId, message, sender }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const messageData = {
      id: Date.now(),
      text: message,
      sender: sender,
      timestamp: new Date()
    };
    
    room.messages.push(messageData);
    
    // Broadcast message to all users in the room
    io.to(roomId).emit('receive-message', messageData);
  });

  // Handle file sharing
  socket.on('share-file', ({ roomId, fileData, sender }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    const fileEntry = {
      id: Date.now(),
      ...fileData,
      sender: sender,
      timestamp: new Date()
    };
    
    room.files.push(fileEntry);
    
    // Broadcast file to all users in the room
    io.to(roomId).emit('receive-file', fileEntry);
  });

  // Handle screen sharing
  socket.on('start-screen-share', ({ roomId, streamId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    // Store screen sharing info
    room.screenShare = {
      userId: socket.id,
      userName: socket.userName,
      streamId: streamId,
      active: true
    };
    
    socket.to(roomId).emit('user-started-screen-share', {
      userId: socket.id,
      userName: socket.userName,
      streamId: streamId
    });
  });

  socket.on('stop-screen-share', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) return;
    
    // Clear screen sharing info
    if (room.screenShare && room.screenShare.userId === socket.id) {
      room.screenShare = null;
    }
    
    socket.to(roomId).emit('user-stopped-screen-share', {
      userId: socket.id,
      userName: socket.userName
    });
  });

  // Handle WebRTC signaling for screen sharing
  socket.on('screen-share-offer', ({ roomId, targetUserId, offer }) => {
    socket.to(targetUserId).emit('screen-share-offer', {
      fromUserId: socket.id,
      fromUserName: socket.userName,
      offer: offer
    });
  });

  socket.on('screen-share-answer', ({ roomId, targetUserId, answer }) => {
    socket.to(targetUserId).emit('screen-share-answer', {
      fromUserId: socket.id,
      answer: answer
    });
  });

  socket.on('screen-share-ice-candidate', ({ roomId, targetUserId, candidate }) => {
    socket.to(targetUserId).emit('screen-share-ice-candidate', {
      fromUserId: socket.id,
      candidate: candidate
    });
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    if (socket.roomId) {
      const room = rooms.get(socket.roomId);
      if (room) {
        // Remove user from room
        if (socket.role === 'instructor') {
          room.instructor = null;
        } else {
          room.students = room.students.filter(student => student.id !== socket.id);
        }
        
        // Notify others in the room
        socket.to(socket.roomId).emit('user-left', { userName: socket.userName });
        
        // Update user list
        const userList = [];
        if (room.instructor) {
          userList.push({ name: room.instructor.name, role: 'instructor' });
        }
        room.students.forEach(student => {
          userList.push({ name: student.name, role: 'student' });
        });
        
        io.to(socket.roomId).emit('user-list', userList);
        
        // If room is empty, delete it
        if (!room.instructor && room.students.length === 0) {
          rooms.delete(socket.roomId);
          console.log(`Room deleted: ${socket.roomId}`);
        }
      }
    }
  });
});

// For any requests that don't match the API routes, send back the React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client/dist', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});