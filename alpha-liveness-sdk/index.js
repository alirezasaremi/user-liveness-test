const tf = require('@tensorflow/tfjs')
const wasmBackend = require('@tensorflow/tfjs-backend-wasm');
const blazeFace = require('@tensorflow-models/blazeface');

class AlphaLivenessSDK {
    constructor(element, modelPath) {

        this.config = {
            consentHint: "",
            consentText: ""
        }

        this.modelPath = modelPath;
        this.element = element;
        this.rectsReference = Array(30).fill(false);
        this.front = null;
        this.model = null;
        this.threshold = 2.5;
        this.listeners = [];
        this.stream = null;
        this.DIP = false;
        this.livenessFinished = false;
        this.consentFinished = false;
        this.countdown = null;
        this.chunks = [];
        this.livenessBlob = null;
        this.consentBlob = null;
        this.isRecording = false;
        this.consentStarted = false;
        this.supportedMimeType = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm';
    }

    setup() {
        wasmBackend.setWasmPaths(this.modelPath, true);
        return new Promise((resolve) => {
            tf.ready().then(() => {
                tf.setBackend('wasm').then(() => {
                    this._loadBlazeFace().then(() => {
                        document.getElementById(this.element).innerHTML = this._template();
                        this.countdown = new Countdown(3, 1500, document.querySelector('.alpha-countdown-container'))
                        navigator.mediaDevices.getUserMedia({
                            video: {
                                width: 320,
                                height: 240,
                                frameRate: {ideal: 15}
                            }, audio: true
                        }).then((stream) => {
                            this.stream = stream;
                            this.videoElement = document.getElementById('alphasdk-video');
                            this.mediaRecorder = new MediaRecorder(this.stream, {mimeType: this.supportedMimeType});

                            this.mediaRecorder.ondataavailable = ({data}) => {
                                if (data.size > 0) {
                                    this.chunks.push(data);
                                }
                                if (this.consentFinished && this.consentStarted) {
                                    this.consentBlob = new Blob(this.chunks, {type: this.supportedMimeType});
                                    this.onConsentReadyListener(this.consentBlob);
                                    this.chunks = [];
                                    return;
                                }
                                if (this.livenessFinished) {
                                    this.livenessBlob = new Blob(this.chunks, {type: this.supportedMimeType});
                                    this.chunks = [];
                                    this.onLivenessReadyListener(this.front, this.livenessBlob);
                                    this._setupConsent();
                                }
                            }
                            this.videoElement.srcObject = this.stream;
                            this.videoElement.addEventListener('loadeddata', () => {
                                resolve()
                            })
                        });
                    })
                })
            })
        });
    }

    start() {
        this.countdown.start(() => {
            this.mediaRecorder.start();
            this._recursiveDetections();
        });
    }

    finished() {
        this.releaseCameraAccess();
        document.querySelector('.rec-button-container').classList.add('hidden');
    }

    onLivenessFinished(callback) {
        this.onLivenessFinishedListener = callback;
    }

    onLivenessReady(callback) {
        this.onLivenessReadyListener = callback;
    }

    onConsentFinished(callback) {
        this.onConsentFinishedListener = callback;
    }

    onConsentReady(callback) {
        this.onConsentReadyListener = callback;
    }

    on(event, fn) {
        this.listeners.push(fn);
    }

    releaseCameraAccess() {
        this.stream.getTracks().forEach((track) => {
            track.stop();
        })
    }

    _recursiveDetections() {
        if (!this.livenessFinished && !this.DIP) {
            this.DIP = true;
            requestAnimationFrame(() => {
                this._detectFace().then(() => {
                    this.DIP = false;
                    if (!(this.rectsReference.find(v => v === false) === undefined)) {
                        this._recursiveDetections()
                    } else {
                        this.livenessFinished = true;
                        this.onLivenessFinishedListener();
                        this.mediaRecorder.stop();
                    }
                })
            })
        } else {
            return;
        }
    }

    _setupConsent() {
        document.querySelector('.alpha-rects-container').classList.add('hidden');
        document.querySelector('.rec-button-container').classList.remove('hidden');
        document.querySelector('.consent-hint').innerHTML = this.config.consentHint;
        document.querySelector('.consent-text').innerHTML = this.config.consentText;
        const recButton = document.querySelector('.rec-button');
        const videoWrapper = document.querySelector('.alpha-video-wrapper');
        this.consentStarted = true;
        recButton.addEventListener('click', () => {
            if (!this.livenessFinished)
                return;
            recButton.classList.toggle('active');
            videoWrapper.classList.toggle('recording');

            if (this.isRecording) {
                this._stopRecording();
                return;
            }

            this._startRecording();
        })
    }

    async _detectFace() {
        const predictions = await this.model.estimateFaces(this.videoElement, false);
        if (predictions.length > 0) {
            let face = predictions[0];
            let start = face.topLeft;
            let end = face.bottomRight;
            let size = [end[0] - start[0], end[1] - start[1]];
            let eye_right = face.landmarks[0];
            let eye_left = face.landmarks[1];
            if (Math.abs(eye_right[1] - eye_left[1]) / size[1] > 0.1)
                return;
            let nose = face.landmarks[2];
            let ry = (eye_left[0] + (eye_right[0] - eye_left[0]) / 2 - nose[0]) / size[0];
            ry = ry * 10;
            if (ry >= this.threshold) {
                ry = this.threshold;
            } else if (ry <= -this.threshold) {
                ry = -this.threshold;
            }

            if (!this.front && (ry <= 0.15 && ry >= -0.15)) {
                let canvas = document.createElement('canvas');
                let sx = Math.max(start[0] - (size[0] * 0.25), 0);
                let sy = Math.max(start[1] - (size[1] * 0.25), 0);
                canvas.width = sx + size[0] * 1.5 > this.videoElement.videoWidth ? this.videoElement.videoWidth - sx : size[0] * 1.5;
                canvas.height = sy + size[1] * 1.5 > this.videoElement.videoHeight ? this.videoElement.videoHeight - sy : size[1] * 1.5;
                let context = canvas.getContext('2d');
                context.drawImage(this.videoElement,
                    sx, sy,
                    canvas.width, canvas.height,
                    0, 0, canvas.width, canvas.height);
                this.front = this._dataURItoBlob(canvas.toDataURL());
            }
            let resultIndex = parseInt(((ry + this.threshold) / (this.threshold * 2)) * (this.rectsReference.length - 1));
            this.rectsReference[resultIndex] = true;
            document.getElementById(`rect-${resultIndex}`).classList.add('stretched');
        }
        return "";
    }

    _dataURItoBlob(dataURI) {
        var byteString = atob(dataURI.split(',')[1]);
        var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);
        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }
        return new Blob([ab], {type: mimeString});
    }

    async _loadBlazeFace() {
        this.model = await blazeFace.load({
            scoreThreshold: 0.95,
            maxFaces: 1,
            modelUrl: this.modelPath + 'model.json',
            fromTFHub: false
        });
    }

    _startRecording() {
        this.consentFinished = false;
        this.isRecording = true;
        this.mediaRecorder.start();
    }

    _stopRecording() {
        this.consentFinished = true;
        this.onConsentFinishedListener();
        this.mediaRecorder.stop();
    }

    _template() {
        return `<div>
                    <div class="alpha-video-wrapper">
                        <video autoplay muted playsinline id="alphasdk-video"></video>
                        <div class="alpha-countdown-container">
                            <div class="alpha-countdown"></div>
                        </div>
                    </div>
                    <div class="rects-container alpha-rects-container">
                        ${this._getRects()}
                    </div>
                    <div class="rec-button-container hidden">
                        <div class="consent-container">
                            <div class="consent-hint"></div>
                            <div class="consent-text"></div>
                        </div>
                        <button class="rec-button"></button>
                    </div>
                </div>`
    }

    _getRects() {
        let template = "";
        this.rectsReference.forEach((val, index) => {
            template += `<div class="rect" id="rect-${index}"></div>`
        })
        return template;
    }
}


class Countdown {
    constructor(countdown = 3, msInterval = 1500, countdownContainerElement) {
        this.countdown = countdown;
        this.interval = msInterval;
        this.countdownWrapperElement = countdownContainerElement;
        this.countdownElement = countdownContainerElement.querySelector('.alpha-countdown');
    }

    start(callback) {
        this.countdownElement.innerHTML = this.countdown.toString();
        this.countdownElement.classList.add('countdown-animate');
        this.countdownElement.style.animationDuration = this.interval + "ms";
        this.countdownElement.style.animationIterationCount = this.countdown;
        this.intervalController = setInterval(() => {
            this.countdown--;
            this.countdownElement.innerHTML = this.countdown.toString();
            if (this.countdown <= 0) {
                this._stopInterval();
                this.countdownWrapperElement.setAttribute('hidden', true);
            }
        }, this.interval);
        setTimeout(() => {
            callback();
        }, this.countdown * this.interval);
    }

    _stopInterval() {
        clearInterval(this.intervalController);
    }
}

module.exports = AlphaLivenessSDK;

