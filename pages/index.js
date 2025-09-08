// pages/index.js
import { useState, useEffect } from 'react';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const ffmpeg = createFFmpeg({ log: true });

export default function Home() {
  const [videoFile, setVideoFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [size, setSize] = useState(960);
  const [quality, setQuality] = useState(3);
  const [status, setStatus] = useState('');
  const [info, setInfo] = useState(null);
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < 768);
    }
  }, []);

  const getVideoDuration = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => resolve(video.duration);
      video.src = URL.createObjectURL(file);
    });
  };

  const handleFileChange = (e) => {
    setVideoFile(e.target.files[0]);
    setStatus('');
    setInfo(null);
  };

  const processVideo = async () => {
    if (!videoFile) return;

    setProcessing(true);
    setStatus('🔄 処理中...');
    setInfo(null);

    const duration = await getVideoDuration(videoFile);
    const targetFrames = 150;
    const calculatedFps = Math.ceil(targetFrames / duration);

    if (!ffmpeg.isLoaded()) await ffmpeg.load();

    try {
      ffmpeg.FS('unlink', 'input.mp4');
    } catch (e) {}

    ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));

    await ffmpeg.run(
      '-i', 'input.mp4',
      '-vf', `fps=${calculatedFps},scale=${size}:-1`,
      '-q:v', quality.toString(),
      'frame_%03d.jpg'
    );

    let files = ffmpeg.FS('readdir', '/').filter(f => f.endsWith('.jpg'));
    if (files.length > 150) {
      files = files.slice(0, 150);
      setStatus(`⚠️ 抽出枚数が150枚を超えたため、先頭150枚に制限しました。`);
    }

    const zip = new JSZip();
    let totalSize = 0;
    let imageWidth = null;
    let imageHeight = null;

    for (const name of files) {
      const data = ffmpeg.FS('readFile', name);
      totalSize += data.length;
      zip.file(name, data.buffer);

      if (!imageWidth) {
        const blob = new Blob([data.buffer], { type: 'image/jpeg' });
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        await new Promise((resolve) => {
          img.onload = () => {
            imageWidth = img.width;
            imageHeight = img.height;
            resolve();
          };
        });
      }
    }

    const totalMB = (totalSize / 1024 / 1024).toFixed(2);
    const qualityLabel = {
      2: '100%',
      3: '92%',
      5: '80%',
      10: '60%',
      15: '50%',
    }[parseInt(quality)] || `${100 - quality * 5}%`;

    const zipFileName = `ugoira_spv2_${imageWidth}x${imageHeight}_${qualityLabel}_${totalMB}MB.zip`;
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, zipFileName);

    setInfo({
      count: files.length,
      width: imageWidth,
      height: imageHeight,
      quality: qualityLabel,
      size: totalMB,
      name: zipFileName,
    });

    setStatus('✅ 完了！ZIPを保存しました。');
    setProcessing(false);
  };

  const layoutStyle = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    gap: '20px',
    padding: '20px',
  };

  const leftStyle = {
    flex: isMobile ? '1 1 100%' : '2 1 0%',
    backgroundColor: '#e0f7fa',
    padding: '10px',
    borderRadius: '8px',
  };

  const rightStyle = {
    flex: isMobile ? '1 1 100%' : '1 1 0%',
    backgroundColor: '#f1f8e9',
    padding: '10px',
    borderRadius: '8px',
  };

  return (
    <div style={layoutStyle}>
      {/* 左カラム：メイン機能 */}
      <div style={leftStyle}>
        <h2 style={{ fontSize: '20px', color: '#0077b6' }}>🎬 MPDU - 動画を分割してZIP保存</h2>

        <input type="file" accept="video/mp4" onChange={handleFileChange} style={{ margin: '10px 0' }} />

        <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
          <label>
            サイズ:
            <select value={size} onChange={(e) => setSize(e.target.value)} style={{ marginLeft: '5px' }}>
              <option value="320">320px</option>
              <option value="640">640px</option>
              <option value="960">960px</option>
              <option value="1280">1280px</option>
              <option value="1920">1920px</option>
            </select>
          </label>

          <label>
            画質:
            <select value={quality} onChange={(e) => setQuality(e.target.value)} style={{ marginLeft: '5px' }}>
              <option value="2">100%</option>
              <option value="3">92%</option>
              <option value="5">80%</option>
              <option value="10">60%</option>
              <option value="15">50%</option>
            </select>
          </label>
        </div>

        <button
          onClick={processVideo}
          disabled={processing || !videoFile}
          style={{
            padding: '10px 20px',
            backgroundColor: '#0077b6',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: processing ? 'not-allowed' : 'pointer',
            opacity: processing ? 0.6 : 1,
          }}
        >
          {processing ? '分割中...' : '分割してZIP保存'}
        </button>

        <p style={{ marginTop: '10px', color: '#555' }}>{status}</p>

        {info && (
          <div style={{ marginTop: '20px', backgroundColor: '#f1f1f1', padding: '10px', borderRadius: '5px' }}>
            <h3 style={{ color: '#2e7d32' }}>📦 出力情報</h3>
            <p>枚数: {info.count}枚</p>
            <p>画像サイズ: {info.width}×{info.height}px</p>
            <p>画質: {info.quality}</p>
            <p>ZIP容量: {info.size}MB</p>
            <p>ファイル名: {info.name}</p>
          </div>
        )}

        {info && (
          <div style={{ marginTop: '20px' }}>
            <h3 style={{ color: '#d81b60' }}>🎉 ダウンロード完了！</h3>
            <video src="/mascot_dance.mp4" autoPlay loop muted style={{ width: '100%', borderRadius: '8px' }} />
          </div>
        )}
      </div>

      {/* 右カラム：使い方ガイド */}
      <div style={rightStyle}>
        <h2 style={{ fontSize: '20px', color: '#f9a825' }}>🧑‍🏫 使い方ガイド</h2>
        <ul style={{ fontSize: '14px', color: '#444' }}>
          <li>MP4動画を選択</li>
          <li>サイズと画質を選ぶ</li>
          <li>「分割してZIP保存」ボタンを押す</li>
        </ul>
        <video src="/mascot_intro.mp4" controls style={{ width: '100%', borderRadius: '8px' }} />
      </div>
    </div>
  );
}