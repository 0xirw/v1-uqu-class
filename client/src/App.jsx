import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState } from 'react';
import Home from './components/Home';
import CreateRoom from './components/CreateRoom';
import JoinRoom from './components/JoinRoom';
import ClassRoom from './components/ClassRoom';
import './App.css';

function App() {
  const [user, setUser] = useState(null);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route 
            path="/create-room" 
            element={<CreateRoom user={user} setUser={setUser} />} 
          />
          <Route 
            path="/join-room" 
            element={<JoinRoom user={user} setUser={setUser} />} 
          />
          <Route 
            path="/room/:roomId" 
            element={<ClassRoom user={user} />} 
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
