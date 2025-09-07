import { useState } from 'react';
import { createFFmpeg, fetchFile } from '@ffmpeg/ffmpeg';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

const ffmpeg = createFFmpeg({ log: true });

export default function Home() {
  const [videoFile, setVideoFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [size, setSize] = useState(960); // スマホ版v2プリセット
  const [quality, setQuality] = useState(3); // 約92%
  const [status, setStatus] = useState('');
  const [info, setInfo] = useState(null);

  const getVideoDuration = (file) => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        resolve(video.duration);
      };
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

    if (!ffmpeg.isLoaded()) {
      await ffmpeg.load();
    }

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

return (
  <div className="flex flex-wrap bg-black text-white min-h-screen p-6 gap-6">

    {/* セクション①：入力と実行 */}
    <div className="w-full md:w-1/2 lg:w-1/2 bg-gray-900 p-4 rounded shadow">
      <h2 className="text-xl font-bold mb-4 text-blue-400">🎬 動画を選択して分割🎬 MPDU - Movie to Picture Direction by Ugoira</h2>

      <input
        type="file"
        accept="video/mp4"
        onChange={handleFileChange}
        className="mb-4 text-white"
      />

      <div className="flex gap-4 mb-4">
        <label>
          サイズ:
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="ml-2 bg-gray-800 text-white p-1 rounded"
          >
            <option value="320">320px</option>
            <option value="640">640px</option>
            <option value="960">960px（スマホ版v2）</option>
            <option value="1280">1280px</option>
            <option value="1920">1920px</option>
          </select>
        </label>

        <label>
          画質:
          <select
            value={quality}
            onChange={(e) => setQuality(e.target.value)}
            className="ml-2 bg-gray-800 text-white p-1 rounded"
          >
            <option value="2">100%</option>
            <option value="3">92%（スマホ版v2）</option>
            <option value="5">80%</option>
            <option value="10">60%</option>
            <option value="15">50%</option>
          </select>
        </label>
      </div>

      <button
        onClick={processVideo}
        disabled={processing || !videoFile}
        className={`px-6 py-2 rounded bg-blue-600 hover:bg-blue-800 transition ${
          processing ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {processing ? '分割中...' : '分割してZIP保存'}
      </button>

      <p className="mt-4 text-sm text-gray-300">{status}</p>
    </div>

    {/* セクション②：出力情報 */}
    {info && (
      <div className="w-full md:w-1/2 lg:w-1/2 bg-gray-900 p-4 rounded shadow">
        <h2 className="text-xl font-bold mb-4 text-green-400">📦 出力情報</h2>
        <div className="text-sm text-green-300">
          <p>枚数: {info.count}枚</p>
          <p>画像サイズ: {info.width}×{info.height}px</p>
          <p>画質: {info.quality}</p>
          <p>ZIP容量: {info.size}MB</p>
          <p>ファイル名: {info.name}</p>
        </div>
      </div>
    )}

    {/* セクション③：使い方＋マスコット動画 */}
    <div className="w-full md:w-1/2 lg:w-1/2 bg-gray-900 p-4 rounded shadow">
      <h2 className="text-xl font-bold mb-4 text-yellow-400">🧑‍🏫 使い方ガイド</h2>
      <ul className="list-disc list-inside text-sm text-gray-300 mb-4">
        <li>MP4動画を選択</li>
        <li>サイズと画質を選ぶ</li>
        <li>「分割してZIP保存」ボタンを押す</li>
      </ul>
      <video src="/mascot_intro.mp4" controls className="w-full rounded" />
    </div>

    {/* セクション④：ダウンロード後の演出 */}
    {info && (
      <div className="w-full md:w-1/2 lg:w-1/2 bg-gray-900 p-4 rounded shadow">
        <h2 className="text-xl font-bold mb-4 text-pink-400">🎉 ダウンロード完了！</h2>
        <video src="/mascot_dance.mp4" autoPlay loop muted className="w-full rounded" />
      </div>
    )}

    {/*🍎display flexが効くかもしれない<div style={{display:"flex",backgroundcolor:"red"}}>*/}
    
    <div style={{display:"grid",gridTemplateColumns: "2fr 1fr"}}>
     
      <div style={{backgroundColor:"blue"}}>40%</div>
      <div style={{backgroundColor:"green"}}>60%</div>
    </div>

  </div>
);
}