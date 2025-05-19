function loadVideo(videoLink) {
  const videoContainer = document.getElementById("video-container");
  videoContainer.innerHTML = `<video controls src="${videoLink}" style="width:100%;"></video>`;
}

function loadDocument(docLink) {
  const docContainer = document.getElementById("document-container");
  docContainer.innerHTML = `<iframe src="${docLink}" style="width:100%;height:500px;"></iframe>`;
}
