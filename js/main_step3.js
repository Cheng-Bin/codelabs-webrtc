'use strict';

let isChannelReady = false;
let isInitiator = false;
let isStarted = false;
let localStream;
let pc;
let remoteStream;
let turnReady;

var pc_config = {'iceServers': [{'url': 'stun:stun.services.mozilla.com'}]};
let pc_constraints = {'optional': [{'DtlsSrtpKeyAgreement': true}]};
var sdpConstraints = {'mandatory': {'OfferToReceiveAudio': true, 'OfferToReceiveVideo': true}};


////////////////// room ////////////////

let room = location.pathname.substring(1);
if (room === '') {
    room = 'foo';
}

var socket = io.connect('http://localhost:2013');

if (room !== '') {
    console.log('Joining room ' + room);
    socket.emit('create or join', room);
}

socket.on('created', function(room) {
    isInitiator  = true;
    console.log('Create Room ' + room);
});

socket.on('full', function(room) {
    console.log('Room ' + room + ' is full');
});


socket.on('join', function(room) {
    console.log('Making request to join room ' + room);
    console.log('You are the initiator!');
    isChannelReady = true;
});

socket.on('joined', function(room) {
    console.log('This peer has joined room ' + room);
    isChannelReady = true;
});


socket.on('log', function(array) {
    console.log.apply(console, array);
});




//////////////////////////////////////

function sendMessage(message) {
    console.log('Client sending message:', message);
    socket.emit('message', message);
}

socket.on('message', function(message) {
    console.log('Client received message: ', message);
    if (message === 'got user media') {
        maybeStart();
    } else if (message.type === 'offer') {
        if (!isInitiator && !isStarted) {
            maybeStart();
        }
        pc.setRemoteDescription(new RTCSessionDescription(message));
        doAnswer();
    } else if (message.type === 'answer' && isStarted) {
        pc.setRemoteDescription(new RTCSessionDescription(message));
    } else if (message.type === 'candidate' && isStarted) {
        let candidate = new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate
        });
        pc.addIceCandidate(candidate);
    } else if (message === 'bye' && isStarted) {
        handleRemoteHangup();
    }

});


////////////////////////////////////////////////////////

let localVideo = document.querySelector('#localVideo');
let remoteVideo = document.querySelector('#remoteVideo');
let constraints = { 
    audio: true,
    video: true 
};


navigator.mediaDevices.getUserMedia(constraints)
                    .then(function(mediaStream) {
                        handleUserMedia(mediaStream);
                    })
                    .catch(function(err) {
                        handleUserMediaError(err);
                    });

function handleUserMedia(stream) {
    console.log('Adding local stream');
    localVideo.src = window.URL.createObjectURL(stream);
    localVideo.play();
    localStream = stream;
    sendMessage('got user media');
    if (isInitiator) {
        maybeStart();
    }
}

function handleUserMediaError(err) {
    console.log('getUserMedia error: ', err);
} 

console.log('Getting user media with constraints ' +  constraints);

//if (location.hostname != 'localhost') {
//   requestTurn('https://computeengineondemand.appspot.com/turn?username=41784574&key=4080218913');
//}

function requestTurn(turn_url) {
    let turnExists = false;

    for (let i in pc_config.iceServers) {
        if (pc_config.iceServers[i].url.substr(0, 5) === 'turn:') {
            turnExists = true;
            turnReady = true;
            break;
        }
    }

    if (!turnExists) {
        console.log('Getting TURN server from ', turn_url);
        let xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4 && xhr.status === 200) {
                var turnServer = JSON.parse(xhr.responseText);
                console.log('Got Turn Server: ' + turnServer);
                pc_config.iceServers.push({
                    'url': 'turn:' + turnServer.username + '@' + turnServer.turn,
                    'credential': turnServer.password
                });
                turnReady = true;
            }
        };
        xhr.open('GET', turn_url, true);
        xhr.send();
    }
} 



function maybeStart() {
    if (!isStarted && typeof localStream != 'undefined' && isChannelReady) {
        createPeerConnection();
        pc.addStream(localStream);
        console.log('isInitiator ', isInitiator);
        if (isInitiator) {
            doCall();
        }
    }
}

window.onbeforeunload = function(e) {
    sendMessage('bye');
}


function handleRemoteHangup() {

}



/////////////////////////////////////////

function createPeerConnection() {

    try {
        pc = new RTCPeerConnection(null);
        pc.onicecandidate = handleIceCandidate;
        pc.onaddstream = handleRemotestreamAdded;
        pc.onremovestream = handleRemotestreamRemoved;
        console.log('Created RTCPeerConnection');
    } catch(e) {
        console.log('Failed to create PeerConnection exception : ' + e.message);
        alert('Cannot create RTCPeerConnection object.');
        return;
    } 

}


function doCall() {
    console.log('Sending offer to peer');
    pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
}

function handleCreateOfferError(error){
  console.log('createOffer() error: ', error);
}

function doAnswer() {
    console.log('Sending answer to peer');
    pc.createAnswer(setLocalAndSendMessage, handleCreateAnswerError, sdpConstraints);
}

function handleCreateAnswerError(error) {
 console.log('createAnswer() error: ', error);
}

function setLocalAndSendMessage(sessionDescription) {
    sessionDescription.sdp = preferOpus(sessionDescription.sdp);
    pc.setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message', sessionDescription);
    sendMessage(sessionDescription);
}


// ICE candidate 
function handleIceCandidate(event) {
    console.log('handleIceCandidate event: ', event);
    if (event.candidate) {
        sendMessage({
            type: 'candidate',
            label: event.candidate.sdpMLineIndex,
            candidate: event.candidate.candidate
        });
    } else {
        console.log('end of candidates.');
    }
}

function handleRemotestreamAdded(event) {
    console.log('Remote stream added : ' + event);
    remoteVideo.src = window.URL.createObjectURL(event.stream);
    remoteVideo.play();
    remoteStream = event.stream;
}

function handleRemotestreamRemoved(event) {
    console.log('Remote stream removed . Event:', event);
}



///////////// Set Opus as the default audio codec if it's present
function preferOpus(sdp) {
    let sdpLines = sdp.split('\r\n');
    let mLineIndex;

    for (let i = 0; i < sdpLines.length; i++) {
        if (sdpLines[i].search('m=audio') !== -1) {
            mLineIndex = i;
            break;
        }
    }

    if (mLineIndex === null) {
        return sdp;
    }

    for (let i = 0; i < sdpLines.length; i++) {
        if (sdpLines[i].search('opus/48000') !== -1) {
            let opusPayload = extractSdp(sdpLines[i], /:(\d+) opus \/48000/i);
            if (opusPayload) {
                sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
            }
            break;
        }
    }

    sdpLines = removeCN(sdpLines, mLineIndex);

    sdp = sdpLines.join('\r\n');
    return sdp;
}


function extractSdp(sdpLine, pattern) {
    let result = sdpLine.match(pattern);
    return (result && result.length == 2) ? result[1] : null;
}

function setDefaultCodec(mLine, payload) {
    let elements = mLine.split(' ');
    let newLine = [];
    let index = 0;

    for (let i = 0; i < elements.length; i++) {
        if (index === 3) {
            newLine[index++] = payload;
        }
        if (elements[i] !== payload) {
            newLine[index++] = elements[i];
        }
    }

    return newLine.join(' ');
}

function removeCN(sdpLines, mLineIndex) {
    let mLineElements = sdpLines[mLineIndex].split(' ');
    for (let i = sdpLines.length - 1; i >= 0; i--) {
        var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
        
        if (payload) {
            let cnPos = mLineElements.indexOf(payload);
            if (cnPos !== -1) {
                mLineElements.split(cnPos, 1);
            }
            sdpLines.splice(i, 1);
        }
    }

    sdpLines[mLineIndex] = mLineElements.join(' ');
    return sdpLines;
}