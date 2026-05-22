const video = document.getElementById("video");
const statusText = document.getElementById("status");

if (!window.faceapi) {
  statusText.textContent = "Face detection library could not be loaded.";
} else {
  Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri("https://justadudewhohacks.github.io/face-api.js/models"),
    faceapi.nets.faceRecognitionNet.loadFromUri("https://justadudewhohacks.github.io/face-api.js/models"),
    faceapi.nets.faceLandmark68Net.loadFromUri("https://justadudewhohacks.github.io/face-api.js/models"),
  ])
    .then(startWebcam)
    .catch(() => {
      statusText.textContent = "Face detection models could not be loaded.";
    });
}

function startWebcam() {
  navigator.mediaDevices
    .getUserMedia({
      video: true,
      audio: false,
    })
    .then((stream) => {
      video.srcObject = stream;
      statusText.textContent = "Camera active. Looking for faces...";
    })
    .catch(() => {
      statusText.textContent = "Camera permission is needed to detect faces.";
    });
}

function getLabeledFaceDescriptions() {
  const labels = ["Felipe", "Messi", "Data"];
  return Promise.all(
    labels.map(async (label) => {
      const descriptions = [];
      for (let i = 1; i <= 2; i++) {
        const img = await faceapi.fetchImage(`./labels/${label}/${i}.png`);
        const detections = await faceapi
          .detectSingleFace(img)
          .withFaceLandmarks()
          .withFaceDescriptor();
        descriptions.push(detections.descriptor);
      }
      return new faceapi.LabeledFaceDescriptors(label, descriptions);
    })
  );
}

video.addEventListener("play", async () => {
  if (!window.faceapi) return;
  const labeledFaceDescriptors = await getLabeledFaceDescriptions().catch(() => []);
  if (!labeledFaceDescriptors.length) {
    statusText.textContent = "Camera active. Label images are unavailable.";
    return;
  }
  const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors);

  const canvas = faceapi.createCanvasFromMedia(video);
  document.body.append(canvas);

  const displaySize = { width: video.width, height: video.height };
  faceapi.matchDimensions(canvas, displaySize);

  setInterval(async () => {
    const detections = await faceapi
      .detectAllFaces(video)
      .withFaceLandmarks()
      .withFaceDescriptors();

    const resizedDetections = faceapi.resizeResults(detections, displaySize);

    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);

    const results = resizedDetections.map((d) => {
      return faceMatcher.findBestMatch(d.descriptor);
    });
    results.forEach((result, i) => {
      const box = resizedDetections[i].detection.box;
      const drawBox = new faceapi.draw.DrawBox(box, {
        label: result,
      });
      drawBox.draw(canvas);
    });
  }, 100);
});
