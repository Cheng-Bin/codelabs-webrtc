'use strict';



let localStream;                            // 本地流
let localPeerConnection;                    // 本地peertopeer 
let remotePeerConnection;                   // 远程peertopeer

let localVideo, remoteVideo;                // video tags
let startButton, callButton, hangupButton;  // button tags

window.onload = function() {

    getElements();
    addEvent();
    initButton();

};


// 获取所有tag
function getElements() {
    localVideo = document.getElementById('localVideo');
    remoteVideo = document.getElementById('remoteVideo');
    startButton = document.getElementById('startButton');
    callButton = document.getElementById('callButton');
    hangupButton = document.getElementById('hangupButton');
}

// 添加event事件
function addEvent() {
    startButton.onclick = start;
    callButton.onclick = call;
    hangupButton.onclick = hangup;
}


// 初始化button
function initButton() {
    startButton.disabled = false;
    callButton.disabled = true;
    hangupButton.disabled = true;
    remoteVideo.style.visibility = 'hidden';
}


function start() {
    trace('Received local stream');
    startButton.disabled = true;

    navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: true 
    }).then(function(mediaStream) {
        localVideo.src = window.URL.createObjectURL(mediaStream);
        localVideo.onloadedmetadata = function(e) {
            localVideo.play();
        };
        localStream = mediaStream;
        callButton.disabled = false;
        remoteVideo.style.visibility = 'visible';
    }).catch(function(err) {
        trace('getUserMedia error: ', err);
    });
}

function call() {
    callButton.disabled = true;
    hangupButton.disabled = false;
    remoteVideo.style.visibility = 'visible';

    trace('Starting call');

    if (localStream.getVideoTracks().length > 0) {
        trace('Using video device: ' + localStream.getVideoTracks()[0].label);
    }

    if (localStream.getAudioTracks().length > 0){
        trace('Using audio device: ' + localStream.getAudioTracks()[0].label);
    }

    var servers = null;

    localPeerConnection = new RTCPeerConnection(servers);
    trace('Create local peer connection object localPeerConnection');
    localPeerConnection.onicecandidate = gotLocalIceCandidate;

    remotePeerConnection = new RTCPeerConnection(servers);
    trace('Created remote peer connection object remotePeerConnection');
    remotePeerConnection.onicecandidate = gotRemoteIceCandidate;
    remotePeerConnection.onaddstream = gotRemoteStream;

    localPeerConnection.addStream(localStream);
    trace('Added localStream to localPeerConnection');
    localPeerConnection.createOffer(gotLocalDescription, handleError);

}


function hangup() {
    trace('Ending call');
    localPeerConnection.close();
    remotePeerConnection.close();

    localPeerConnection = null;
    remotePeerConnection = null;

    hangupButton.disabled = true;
    callButton.disabled = false;
    remoteVideo.style.visibility = 'hidden';
};


function gotLocalIceCandidate(event) {
    if (event.candidate) {
        remotePeerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
        trace('Local ICE candidate: \n' + event.candidate.candidate);
    }
}


function gotRemoteIceCandidate(event) {
    if (event.candidate) {
        localPeerConnection.addIceCandidate(new RTCIceCandidate(event.candidate));
        trace('Remote ICE candidate:\n' + event.candidate.candidate);
    }
}


function gotRemoteStream(event) {
    remoteVideo.src = URL.createObjectURL(event.stream);
    remoteVideo.play();
    trace('Received remote stream');
}


function gotLocalDescription(description) {
    localPeerConnection.setLocalDescription(description);
    trace('Offer from localPeerConnection: \n' + description.sdp);
    remotePeerConnection.setRemoteDescription(description);
    remotePeerConnection.createAnswer(gotRemoteDescription, handleError);
}


function gotRemoteDescription(description) {
    remotePeerConnection.setLocalDescription(description);
    trace('Answer from remotePeerConnection: \n' + description.sdp);
    localPeerConnection.setRemoteDescription(description);
}


function trace(text) {
    console.log((performance.now() / 1000).toFixed(3) + ':' + text);
}

function handleError() {

}