// Chat.js
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

let socket;
const CONNECTION_PORT = 'localhost:3001/';

function Chat({ room, userName }) {
  const [message, setMessage] = useState('');
  const [messageList, setMessageList] = useState([]);

  useEffect(() => {
    socket = io(CONNECTION_PORT);

    socket.on('receive_message', (data) => {
      setMessageList([...messageList, data]);
    });
  }, [messageList]);

  const sendMessage = async () => {
    let messageContent = {
      room: room,
      content: {
        author: userName,
        message: message,
      },
    };

    await socket.emit('send_message', messageContent);
    setMessageList([...messageList, messageContent.content]);
    setMessage('');
  };

  return (
    <div className="Chat">
      <div className="messages">
        {messageList.map((messageContent) => {
          return (
            <div className="message">
              <p>{messageContent.author}: {messageContent.message}</p>
            </div>
          );
        })}
      </div>
      <input
        type="text"
        placeholder="Message..."
        onChange={(e) => {
          setMessage(e.target.value);
        }}
      />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
}

export default Chat;
