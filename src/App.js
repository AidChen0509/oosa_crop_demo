import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import getCroppedImg from './cropImage'; // 引入輔助函數
import './App.css'; // 我稍後會建立這個檔案

const App = () => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [imageToCrop, setImageToCrop] = useState(null); // 用於儲存使用者上傳的圖片或預設圖片
  const [croppedImage, setCroppedImage] = useState(null); // 新增狀態來儲存裁剪後的圖片 URL
  const [downloadFormat, setDownloadFormat] = useState('image/png');
  const [imageQuality, setImageQuality] = useState(0.92);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixelsValue) => {
    setCroppedAreaPixels(croppedAreaPixelsValue);
  }, []);

  // Generates a PNG for preview
  const showCroppedImagePreview = useCallback(async () => {
    if (!imageToCrop || !croppedAreaPixels) {
      alert('請先上傳圖片並完成裁剪。');
      return;
    }
    try {
      // Preview always uses PNG for best transparency handling with circular crop
      const croppedImgResult = await getCroppedImg(
        imageToCrop,
        croppedAreaPixels,
        rotation,
        { horizontal: false, vertical: false }, // flip (optional)
        'image/png' // Format for preview
      );
      setCroppedImage(croppedImgResult);
      // Auto-save settings after successful preview generation
      if (imageToCrop && croppedAreaPixels) {
        try {
          const imageKey = imageToCrop.substring(0, 50);
          localStorage.setItem(
            'cropSettings-' + imageKey,
            JSON.stringify({ crop, zoom, rotation, croppedAreaPixels })
          );
        } catch (error) {
          console.error("Error saving to localStorage:", error);
        }
      }
    } catch (e) {
      console.error('Error cropping image for preview:', e);
      alert('圖片預覽生成失敗，請檢查控制台錯誤。');
    }
  }, [imageToCrop, croppedAreaPixels, rotation, crop, zoom]);

  const handleDownload = useCallback(async () => {
    if (!imageToCrop || !croppedAreaPixels) {
      alert('請先上傳圖片並完成裁剪以供下載。');
      return;
    }
    try {
      const blobUrl = await getCroppedImg(
        imageToCrop,
        croppedAreaPixels,
        rotation,
        { horizontal: false, vertical: false },
        downloadFormat,
        imageQuality
      );
      const link = document.createElement('a');
      link.href = blobUrl;
      const extension = downloadFormat.split('/')[1] || 'png';
      link.download = `cropped-image.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl); // Clean up the blob URL
    } catch (e) {
      console.error('Error generating image for download:', e);
      alert('圖片下載生成失敗，請檢查控制台錯誤。');
    }
  }, [imageToCrop, croppedAreaPixels, rotation, downloadFormat, imageQuality]);

  const onFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        const newImageSrc = reader.result;
        setImageToCrop(newImageSrc);
        setCroppedImage(null);
        try {
          const imageKey = newImageSrc.substring(0, 50);
          const savedSettings = localStorage.getItem('cropSettings-' + imageKey);
          if (savedSettings) {
            const { crop: savedCrop, zoom: savedZoom, rotation: savedRotation, croppedAreaPixels: savedPixels } = JSON.parse(savedSettings);
            setCrop(savedCrop || { x: 0, y: 0 });
            setZoom(savedZoom || 1);
            setRotation(savedRotation || 0);
            setCroppedAreaPixels(savedPixels || null);
            // Optionally, auto-generate preview if old settings are loaded
            // if (savedPixels && newImageSrc) {
            //   showCroppedImagePreview(); // Call the preview function
            // }
          } else {
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setRotation(0);
            setCroppedAreaPixels(null);
          }
        } catch (error) {
          console.error("Error loading from localStorage:", error);
          setCrop({ x: 0, y: 0 });
          setZoom(1);
          setRotation(0);
          setCroppedAreaPixels(null);
        }
      });
      reader.readAsDataURL(file);
    }
  };

  // 手動儲存和載入按鈕 (可選)
  const handleSaveSettings = () => {
    if (imageToCrop && croppedAreaPixels) {
      try {
        const imageKey = imageToCrop.substring(0, 50);
        localStorage.setItem(
          'cropSettings-' + imageKey,
          JSON.stringify({ crop, zoom, rotation, croppedAreaPixels })
        );
        alert('目前裁剪設定已儲存!');
      } catch (error) {
        console.error("Error saving to localStorage:", error);
        alert('儲存設定失敗!');
      }
    } else {
      alert('沒有圖片或裁剪區域可儲存。');
    }
  };

  const handleLoadSettings = () => {
    if (imageToCrop) {
      try {
        const imageKey = imageToCrop.substring(0, 50);
        const savedSettings = localStorage.getItem('cropSettings-' + imageKey);
        if (savedSettings) {
          const { crop: savedCrop, zoom: savedZoom, rotation: savedRotation, croppedAreaPixels: savedPixels } = JSON.parse(savedSettings);
          setCrop(savedCrop || { x: 0, y: 0 });
          setZoom(savedZoom || 1);
          setRotation(savedRotation || 0);
          setCroppedAreaPixels(savedPixels || null);
          alert('已載入儲存的設定!');
          // 載入後可以選擇是否自動顯示裁剪結果
          if (savedPixels && imageToCrop) {
            //   showCroppedImage(); // 這會重新計算並顯示，如果 croppedImage 狀態也存取會更好
            //   可以直接用 savedPixels 去產生 croppedImage, 如果 getCroppedImg 支援
            //   或者，更簡單的方式是讓使用者點擊「顯示/更新裁剪結果」按鈕
          }
        } else {
          alert('找不到此圖片的儲存設定。');
        }
      } catch (error) {
        console.error("Error loading from localStorage:", error);
        alert('載入設定失敗!');
      }
    } else {
      alert('請先上傳圖片才能載入設定。');
    }
  };

  return (
    <div className="App">
      <div className="controls top-controls">
        <input type="file" accept="image/*" onChange={onFileChange} />
      </div>
      <div className="main-content">
        <div className="crop-container">
          {imageToCrop ? (
            <Cropper
              image={imageToCrop}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
            />
          ) : (
            <p>請上傳一張圖片進行裁剪。</p>
          )}
        </div>
        {croppedImage && (
          <div className="cropped-image-container">
            <h3>裁剪結果預覽 (PNG):</h3>
            <img src={croppedImage} alt="Cropped Preview" style={{ maxWidth: '100%', maxHeight: '300px' }} />
          </div>
        )}
      </div>
      {imageToCrop && (
        <div className="controls bottom-controls">
          <div className="slider-container">
            <label htmlFor="zoom">縮放: {zoom.toFixed(2)}</label>
            <input id="zoom" type="range" value={zoom} min={1} max={3} step={0.1} onChange={(e) => setZoom(Number(e.target.value))} className="slider"/>
          </div>
          <div className="slider-container">
            <label htmlFor="rotation">旋轉: {rotation}°</label>
            <input id="rotation" type="range" value={rotation} min={0} max={360} step={1} onChange={(e) => setRotation(Number(e.target.value))} className="slider" />
          </div>
          <button onClick={showCroppedImagePreview} className="show-result-button">
            顯示/更新預覽
          </button>
          
          <div className="download-options">
            <h4>下載選項:</h4>
            <label htmlFor="format">格式: </label>
            <select id="format" value={downloadFormat} onChange={(e) => setDownloadFormat(e.target.value)}>
              <option value="image/png">PNG</option>
              <option value="image/jpeg">JPEG</option>
              {/* <option value="image/webp">WEBP</option> */}
            </select>
            {downloadFormat === 'image/jpeg' && (
              <div className="slider-container quality-slider">
                <label htmlFor="quality">JPEG 品質: {imageQuality.toFixed(2)}</label>
                <input id="quality" type="range" value={imageQuality} min={0.1} max={1} step={0.01} onChange={(e) => setImageQuality(Number(e.target.value))} className="slider" />
              </div>
            )}
            <button onClick={handleDownload} className="download-button actual-download-button">
              下載圖片
            </button>
          </div>

          <button onClick={handleSaveSettings} className="control-button">
            儲存目前設定
          </button>
          <button onClick={handleLoadSettings} className="control-button">
            載入儲存設定
          </button>
        </div>
      )}
    </div>
  );
};

export default App; 