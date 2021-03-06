'use strict';

navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

window.onbeforeunload = function(e){
  hangup();
}

var sendChannel, receiveChannel;
var sendButton = document.getElementById("sendButton");
var sendTextarea = document.getElementById("dataChannelSend");
var receiveTextarea = document.getElementById("dataChannelReceive");

var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');

sendButton.onclick = sendData;

var isChannelReady;
var isInitiator;
var isStarted;

var localStream;
var remoteStream;
var pc;

var room;

var pc_config = webrtcDetectedBrowser === 'firefox' ?
  {'iceServers':[{'urls':'stun:23.21.150.121'}]} : // IP address
  {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]};

var pc_constraints = {
  'optional': [
    {'DtlsSrtpKeyAgreement': true},
    {'RtpDataChannels': true}
  ]};

var sdpConstraints = webrtcDetectedBrowser === 'firefox' ?
    {'offerToReceiveAudio':true,'offerToReceiveVideo':true } :
    {'mandatory': {'OfferToReceiveAudio':true, 'OfferToReceiveVideo':true }};



var room = prompt('Enter room name:');

var socket = new WebSocket("ws://localhost:5000/signal");

if (room !== '') {
  console.log('Create or join room', room);
  //var msg = '{"type": "createjoin", "label": "ds","id": "ds","candidate": "ds","room": "'+room+'"}';
  var msg = {};
  msg.type = "createjoin";
  msg.label = "";
  msg.candidate = "";
  msg.room = room;

  sendMessage(msg, "common");
}

var constraints = {video: true};

console.log('Getting user media with constraints', constraints);

function waitForSocketConnection(socket, callback){
        setTimeout(
            function(){
                if (socket.readyState === 1) {
                    if(callback !== undefined){
                        callback();
                    }
                    return;
                } else {
                    waitForSocketConnection(socket,callback);
                }
            }, 5);
 };

function handleUserMedia(stream) {
  localStream = stream;
  attachMediaStream(localVideo, stream);
  console.log('Adding local stream.');
  msg = {}
  msg.type = "gotusermedia";
  msg.label = "";
  msg.id = "gotusermedia";
  msg.candidate = "";
  msg.room = room

  //var msg = '{"type": "gotusermedia", "label": "ds","id": "ds","candidate": "ds"}'
  sendMessage(msg, "common");
  if (isInitiator) {
    checkAndStart();
  }
}

function handleUserMediaError(error){
  console.log('navigator.getUserMedia error: ', error);
}

 socket.onmessage = function(e) {
   var msg;
   var type="";

   try {
     var msg = JSON.parse(event.data);
     type = msg.type;
   } catch (e) {
     type = event.data;
   }
    switch(type) {
        case 'created':
            navigator.getUserMedia(constraints, handleUserMedia, handleUserMediaError);
            console.log('Created room ' + room);
            room = room
            isInitiator = true;
            break;
        case 'full':
            console.log('Room is full');
            break;
        case 'join':
            isChannelReady = true;
            break;
        case 'joined':
            navigator.getUserMedia(constraints, handleUserMedia, handleUserMediaError);
            isChannelReady = true;
            break;
        case 'gotusermedia':
            checkAndStart();
            break;
        case 'offer':
            if (!isInitiator && !isStarted) {
                  checkAndStart();
            }

            var remoteDescription = new RTCSessionDescription(msg)
            pc.setRemoteDescription(remoteDescription);

            doAnswer();
            break;
        case 'answer':
            if (isStarted)
            {
              pc.setRemoteDescription(new RTCSessionDescription(msg));
            }
            break;
        case 'candidate':
            if (isStarted)
            {
              var candidate = new RTCIceCandidate({sdpMLineIndex:msg.label,candidate:msg.candidate});
              pc.addIceCandidate(candidate);
            }
            break;
        case 'bye':
            if (isStarted)
            {
              handleRemoteHangup()
            }
            break;
        default:
            console.log('unknown message');
            break;
    }

};


function sendMessage(message, baseMessageType){

  var messageToSend = {};
  messageToSend.type = baseMessageType;
  messageToSend.room = room;
  messageToSend.Message = message;
  waitForSocketConnection(socket, function() {
             socket.send(JSON.stringify(messageToSend));
        });
  console.log('Sending message: ', messageToSend);

}

function checkAndStart() {
  if (!isStarted && typeof localStream != 'undefined' && isChannelReady) {
    createPeerConnection();
    pc.addStream(localStream);
    isStarted = true;
    if (isInitiator) {
      doCall();
    }
  }
}

function createPeerConnection() {
  try {
    pc = new RTCPeerConnection(pc_config, pc_constraints);
    pc.onicecandidate = handleIceCandidate;
    console.log('Created RTCPeerConnnection with:\n' +
      '  config: \'' + JSON.stringify(pc_config) + '\';\n' +
      '  constraints: \'' + JSON.stringify(pc_constraints) + '\'.');
  } catch (e) {
    console.log('Failed to create PeerConnection, exception: ' + e.message);
    alert('Cannot create RTCPeerConnection object.');
      return;
  }
  pc.onaddstream = handleRemoteStreamAdded;
  pc.onremovestream = handleRemoteStreamRemoved;

  if (isInitiator) {
    try {
      sendChannel = pc.createDataChannel("sendDataChannel",
        {reliable: false});
      trace('Created send data channel');
    } catch (e) {
      alert('Failed to create data channel. ');
      trace('createDataChannel() failed with exception: ' + e.message);
    }
    sendChannel.onopen = handleSendChannelStateChange;
    sendChannel.onmessage = handleMessage;
    sendChannel.onclose = handleSendChannelStateChange;
  } else { // Joiner
    pc.ondatachannel = gotReceiveChannel;
  }
}

function sendData() {
  var data = sendTextarea.value;
  if(isInitiator) sendChannel.send(data);
  else receiveChannel.send(data);
  trace('Sent data: ' + data);
}

function gotReceiveChannel(event) {
  trace('Receive Channel Callback');
  receiveChannel = event.channel;
  receiveChannel.onmessage = handleMessage;
  receiveChannel.onopen = handleReceiveChannelStateChange;
  receiveChannel.onclose = handleReceiveChannelStateChange;
}

function handleMessage(event) {
  trace('Received message: ' + event.data);
  receiveTextarea.value += event.data + '\n';
}

function handleSendChannelStateChange(event) {
  var readyState = sendChannel.readyState;
  trace('Send channel state is: ' + readyState);
  // If channel ready, enable user's input
  if (readyState == "open") {
    dataChannelSend.disabled = false;
    dataChannelSend.focus();
    dataChannelSend.placeholder = "";
    sendButton.disabled = false;
  } else {
    dataChannelSend.disabled = true;
    sendButton.disabled = false;
  }
}

function handleReceiveChannelStateChange() {
  var readyState = receiveChannel.readyState;
  trace('Receive channel state is: ' + readyState);
  // If channel ready, enable user's input
  if (readyState == "open") {
      dataChannelSend.disabled = false;
      dataChannelSend.focus();
      dataChannelSend.placeholder = "";
      sendButton.disabled = false;
    } else {
      dataChannelSend.disabled = false;
      sendButton.disabled = false;
    }
}

function handleIceCandidate(event) {
  console.log('handleIceCandidate event: ', event);
  if (event.candidate) {
    sendMessage({
      type: 'candidate',
      label: event.candidate.sdpMLineIndex,
      id: event.candidate.sdpMid,
      candidate: event.candidate.candidate}, "rtc");
  } else {
    console.log('End of candidates.');
  }
}

function doCall() {
  console.log('Creating Offer...');
  pc.createOffer(setLocalAndSendMessage, onSignalingError, sdpConstraints);
}

function onSignalingError(error) {
  console.log('Failed to create signaling message : ' + error.name);
}

function onRemoteDescriptionSuccess(success)
{
    doAnswer();
}

function onRemoteDescriptionError(error)
{

}

function doAnswer() {
  console.log('Sending answer to peer.');
  pc.createAnswer(setLocalAndSendMessage, onSignalingError, sdpConstraints);
}

// Success handler for both createOffer()
// and createAnswer()
function setLocalAndSendMessage(sessionDescription) {
  pc.setLocalDescription(sessionDescription);
  sendMessage(sessionDescription, "rtc");
}

/////////////////////////////////////////////////////////
// Remote stream handlers...

function handleRemoteStreamAdded(event) {
  console.log('Remote stream added.');
  attachMediaStream(remoteVideo, event.stream);
  remoteStream = event.stream;
}

function handleRemoteStreamRemoved(event) {
  console.log('Remote stream removed. Event: ', event);
}

function hangup() {
  console.log('Hanging up.');
  stop();
  var msg = {
      type: 'bye',
      label: '',
      id: '',
      candidate: ''}
  sendMessage(msg, "common");

}

function handleRemoteHangup() {
  console.log('Session terminated.');
  stop();
  isInitiator = false;
}

function stop() {
  isStarted = false;
  if (sendChannel) sendChannel.close();
  if (receiveChannel) receiveChannel.close();
  if (pc) pc.close();
  pc = null;
  sendButton.disabled=false;
}
