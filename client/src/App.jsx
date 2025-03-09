import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { DiscordSDK } from "@discord/embedded-app-sdk";

const CONNECTION_PORT = 'http://localhost:3001';
let socket;

const discordSdk = new DiscordSDK(import.meta.env.VITE_DISCORD_CLIENT_ID);

function App() {
  const [auth, setAuth] = useState(false);
  const [room, setRoom] = useState('');
  const [user, setUser] = useState('');
  const [roomUsers, setRoomUsers] = useState([]);
  const [impostor, setImpostor] = useState('');
  const [word, setWord] = useState('');
  const [message, setMessage] = useState('');
  const [creator, setCreator] = useState('');
  const [join, setJoin] = useState(false);
  const [create, setCreate] = useState(false);
  const [roundStarted, setRoundStarted] = useState(false);
  const [roundFinished, setRoundFinished] = useState(false);

  useEffect(() => {

    console.log('Start')

    const setupDiscordSDK = async () => {
      await discordSdk.ready()
  
      const { code } = await discordSdk.commands.authorize({
        client_id: import.meta.env.VITE_DISCORD_CLIENT_ID,
        response_type: "code",
        state: "",
        prompt: "none",
        scope: [
          "identify",
          "guilds",
          "applications.commands"
        ],
      });
  
      const response = await fetch("/.proxy/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          code,
        }),
      });
  
      const { access_token } = await response.json();
  
      const authent = await discordSdk.commands.authenticate({
        access_token,
      });

      setAuth(authent);
    }
  
    setupDiscordSDK();

    return () => {
      socket.disconnect();
      socket.off('users_in_room');
      socket.off('role_assigned');
      socket.off('round_ended');
    };
  }, []);

  useEffect(() => {
    socket = io(CONNECTION_PORT, {
      // transports: ['websocket'],
      path: '/.proxy/socket/',
      auth: {
          token: auth.access_token
      },
    });

    console.log('socket')
    console.log(socket)

    socket.on('room_data', (roomdata) => {
      console.log('roomdata', roomdata);
      setRoomUsers(roomdata['users']);
      setCreator(roomdata['creator']);
    });

    socket.on('round_started', (roomData) => {
      setImpostor(roomData.impostor);
      setWord(roomData.word);
      setRoundStarted(true);
      setRoundFinished(false);
    });

    socket.on('round_ended', (impostor) => {
      console.log('round_ended!')
      setMessage(`Round ended! The impostor was: ${impostor}`);
      setImpostor('');

      setWord('');
      setRoundStarted(false);
      setRoundFinished(true);
      
    });

    const getDetails = async () => {
      let activityChannelName = "Unknown";
    
      // 1. From the HTTP API fetch a list of all of the user's guilds
      const guilds = await fetch(`https://discord.com/api/v10/users/@me/guilds`, {
        headers: {
          // NOTE: we're using the access_token provided by the "authenticate" command
          Authorization: `Bearer ${auth.access_token}`,
          'Content-Type': 'application/json',
        },
      }).then((response) => response.json());
    
      const currentGuild = guilds.find((g) => g.id === discordSdk.guildId);
    
      // Requesting the channel in GDMs (when the guild ID is null) requires
      // the dm_channels.read scope which requires Discord approval.
      if (discordSdk.channelId != null && discordSdk.guildId != null) {
        // Over RPC collect info about the channel
        const channel = await discordSdk.commands.getChannel({channel_id: discordSdk.channelId});
        if (channel.name != null) {
          activityChannelName = channel.name;
        }
      }
    
      const currentUser = await fetch(`https://discord.com/api/v10/users/@me`, {
        headers: {
          // NOTE: we're using the access_token provided by the "authenticate" command
          Authorization: `Bearer ${auth.access_token}`,
          'Content-Type': 'application/json',
        },
      }).then((response) => response.json());
    
      setRoom(`${currentGuild.name}/${activityChannelName}`);
      setUser(currentUser.global_name);
    }

    if (auth == null) {
      throw new Error("Authenticate command failed");
    }

    getDetails();

  }, [auth]);

  useEffect(() => {
    console.log('room', room);
    console.log('user', user);
    if (user && room) {
      socket.emit(`join_room`, { room, user }, (success) => {
        if (success) {
          console.log(room)
        } else {
          alert(`Failed to join room`);
        }
      });
    }
  }, [room, user]);

  useEffect(() => {
    if (impostor){
      if (user === impostor){
        setMessage('You are the impostor!');
      }
      else{
        setMessage(`The word is ${word}`)
      }
    }    
  }, [impostor]);

  const exitFromRoom = () => {
    socket.emit('leave_room', { room, user }, success => {
      if (success) {
        setUser('');
        setRoom('');
        setLoggedIn(false);
        setImpostor('');
        setMessage('');
        setRoundStarted(false);
        setRoundFinished(false);
      }
    });
  };

  const startRound = () => {
    socket.emit('start_round', { room, user }, (success) => {
      console.log(success);
      if (success) {
        console.log('Round started');
      } else {
        alert('Error: Could not start round');
      }
    });
  };

  const endRound = () => {
    socket.emit('end_round', { room, user }, (success) => {
      if (success) {
        console.log('Round ended');
      } else {
        alert('Only the room creator can end the round');
      }
    });
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="content">
          <>{
            !roundStarted && !roundFinished ?
              <>
                <h1>{user}, You are in room: {room}</h1>
                {/* <p>{message}</p> */}
                <div>
                  <p>Users in this room:</p>
                  {roomUsers.map((u, index) => (
                    <p key={index}>{u} {u === creator ? "(Creator)" : ""}</p>
                  ))}
                </div>
                {user === creator && (
                  <div>
                    <button onClick={startRound}>Start Round</button>
                  </div>
                )}
                <button onClick={exitFromRoom}>Leave Room</button>
              </>
            :roundStarted ?
              <>
                <h1>{message}</h1>
                {user === creator && (
                  <div>
                    <button onClick={endRound}>End Round</button>
                  </div>
                )}
              </>
            :
              <>
                <h1>{message}</h1>
                {user === creator && <button onClick={startRound}>Start Round</button>}
                <button onClick={exitFromRoom}>Leave Room</button>
              </>
          }</>
        </div>
      </header>
    </div>
  );
}

export default App;
