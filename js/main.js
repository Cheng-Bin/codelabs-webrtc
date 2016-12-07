'use strict';


let localStream;            // 本地流
let localPeerConnection;    // 本地peertopeer 
let remotePeerConnection;   // 远程peertopeer

let localVideo  =   document.getElementById('localVideo');
let remoteVideo =   document.getElementById('remoteVideo');

/*
let p = navigator.mediaDevices.getUserMedia(
    { 
        audio: true,
        video: true 
    }
);

p.then(function(mediaStream) {

    let video = document.querySelector('video');
    video.src = window.URL.createObjectURL(mediaStream);
    video.onloadedmetadata = function(e) {
            video.play();
    };

}).catch(function(err) {

    console.log(err.name);

});
*/