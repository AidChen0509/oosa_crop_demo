/**
 * 從 URL 創建一個 Image 物件。
 * @param {string} url - 圖片的 URL 或 Data URL。
 * @returns {Promise<HTMLImageElement>} - 返回一個 Promise，解析為載入完成的 Image 物件。
 */
export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); // needed to avoid cross-origin issues
    image.src = url;
  });

/**
 * 將圖片根據提供的裁剪參數進行裁剪、旋轉和處理，並返回一個包含結果圖片的 Blob URL。
 * 這個函數處理了旋轉後的邊界計算，並將最終結果裁剪成圓形。
 *
 * @param {string} imageSrc - 原始圖片的來源 (URL 或 Data URL)。
 * @param {object} pixelCrop - 裁剪區域的像素座標和尺寸 { x, y, width, height }。
 * @param {number} [rotation=0] - 圖片的旋轉角度 (單位：度)。
 * @param {object} [flip={ horizontal: false, vertical: false }] - 是否水平或垂直翻轉圖片。
 * @param {string} [outputFormat='image/png'] - 輸出的圖片格式 (例如 'image/png', 'image/jpeg')。
 * @param {number} [outputQuality=0.92] - 輸出 JPEG 格式時的品質 (0.1 到 1)。
 * @returns {Promise<string|null>} - 返回一個 Promise，解析為裁剪後圖片的 Blob URL，如果發生錯誤則為 null。
 */
export default async function getCroppedImg(
  imageSrc,
  pixelCrop,
  rotation = 0,
  flip = { horizontal: false, vertical: false },
  outputFormat = 'image/png',
  outputQuality = 0.92
) {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    return null;
  }

  // 將旋轉角度轉換為弧度
  const rotRad = getRadianAngle(rotation);

  // 計算旋轉後圖片的邊界框大小
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(
    image.width,
    image.height,
    rotation
  );

  // 設定 canvas 的尺寸以容納旋轉後的圖片
  canvas.width = bBoxWidth;
  canvas.height = bBoxHeight;

  // 將 canvas 的繪圖原點移動到中心，以便圍繞中心進行旋轉和縮放
  ctx.translate(bBoxWidth / 2, bBoxHeight / 2);
  ctx.rotate(rotRad);
  ctx.scale(flip.horizontal ? -1 : 1, flip.vertical ? -1 : 1);
  ctx.translate(-image.width / 2, -image.height / 2);

  // 在 canvas 上繪製經過旋轉和翻轉的圖片
  ctx.drawImage(image, 0, 0);

  // 從旋轉後的 canvas 上提取未經圓形裁剪的像素數據
  // 注意：這裡的 pixelCrop 座標是相對於未旋轉的圖片，但 getImageData 是作用在旋轉後的 canvas 上，
  // 這一部分的邏輯是基於 react-easy-crop 計算出的 pixelCrop 來實現的。
  const data = ctx.getImageData(
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height
  );

  // 將 canvas 的尺寸重設為最終裁剪的尺寸
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  // 計算圓心和半徑以繪製圓形遮罩
  const centerX = pixelCrop.width / 2;
  const centerY = pixelCrop.height / 2;
  const radius = Math.min(pixelCrop.width, pixelCrop.height) / 2;

  // 如果輸出格式為 JPEG，先填充白色背景 (因為 JPEG 不支援透明度)
  if (outputFormat === 'image/jpeg') {
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 創建圓形路徑並設置為裁剪區域 (clipping path)
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI, false);
  ctx.closePath();
  ctx.clip(); // 此後的繪圖操作只會影響裁剪區域內的內容

  // 創建一個臨時 canvas 來放置之前提取的矩形像素數據
  // 這是為了將正確的部分繪製到最終被圓形裁剪的 canvas 上
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = pixelCrop.width;
  tempCanvas.height = pixelCrop.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (!tempCtx) {
    console.error('Failed to get 2D context from temporary canvas');
    return null;
  }
  tempCtx.putImageData(data, 0, 0);
  
  // 將臨時 canvas 的內容 (即原始裁剪區域的像素) 繪製到主 canvas 上
  // 由於主 canvas 已經設置了圓形裁剪區域，所以只會繪製圓形部分的內容
  ctx.drawImage(tempCanvas, 0, 0, pixelCrop.width, pixelCrop.height);

  // 將最終的 canvas 內容轉換為 Blob 並創建 Object URL
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (file) => {
        if (file) {
          resolve(URL.createObjectURL(file));
        }
        else {
          reject(new Error('Canvas is empty after attempting to draw cropped image.'));
        }
      },
      outputFormat,
      outputQuality
    );
  });
}

/**
 * 將角度值轉換為弧度值。
 * @param {number} degreeValue - 角度值 (0-360)。
 * @returns {number} - 對應的弧度值。
 */
export function getRadianAngle(degreeValue) {
  return (degreeValue * Math.PI) / 180;
}

/**
 * 計算一個矩形旋轉指定角度後的新邊界框 (bounding box) 尺寸。
 * @param {number} width - 原始寬度。
 * @param {number} height - 原始高度。
 * @param {number} rotation - 旋轉角度 (單位：度)。
 * @returns {{width: number, height: number}} - 包含旋轉後寬度和高度的物件。
 */
export function rotateSize(width, height, rotation) {
  const rotRad = getRadianAngle(rotation);
  return {
    width:
      Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height:
      Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
} 