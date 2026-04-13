import { useState, useEffect } from 'react';

export default function LoadingSpinner({ message, messages }) {
  var _msgIndex = 0;
  const [msgIndex, setMsgIndex] = useState(_msgIndex);

  useEffect(function () {
    if (!messages || messages.length <= 1) return;
    var interval = setInterval(function () {
      setMsgIndex(function (prev) { return (prev + 1) % messages.length; });
    }, 2500);
    return function () { clearInterval(interval); };
  }, [messages]);

  var displayMessage = messages ? messages[msgIndex] : message;

  return (
    <div className="spinner-container">
      <div className="spinner" />
      {displayMessage && <p className="spinner-message">{displayMessage}</p>}
    </div>
  );
}
