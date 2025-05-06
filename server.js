import React, { useState, useEffect, useRef } from 'react';
import domtoimage from 'dom-to-image-more';
import './fonts.css';
import axios from 'axios';

function App() {
  const [title, setTitle] = useState("Card title");
  const [subtitle, setSubtitle] = useState("· Defense ·");
  const [description, setDescription] = useState(
    "This is the card description. It can be long and detailed and it tolerates <b>html</b>."
  );
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [hpCost, setHpCost] = useState("3");
  const [spCost, setSpCost] = useState("1");
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [titleFontSize, setTitleFontSize] = useState(45); // Font size for title
  const [titlePositionY, setTitlePositionY] = useState(205); // Vertical position for title
  const [cardType, setCardType] = useState('physical'); // New state for card type
  const [exportScale, setExportScale] = useState(2); // Default scale is 2
  const [imageScale, setImageScale] = useState(1); // 1 = 100%
  const [gallery, setGallery] = useState([]);

  const cardRef = useRef(null);

  useEffect(() => {
    axios.get('http://localhost:5000/gallery')
      .then(res => setGallery(res.data))
      .catch(err => console.error('Failed to fetch gallery:', err));
  }, []);

  useEffect(() => {
    if (!imageFile) return;
    setImageUrl(URL.createObjectURL(imageFile));
  }, [imageFile]);

  const handleSaveImage = () => {
    if (!cardRef.current) return;
  
    document.fonts.ready
      .then(() => {
        setTimeout(() => {
          const node = cardRef.current;
          const width = 384;
          const height = 617;
          const scale = exportScale;
          const exportWidth = width * scale;
          const exportHeight = height * scale;
  
          const clone = node.cloneNode(true);
          clone.style.transform = `scale(${scale})`;
          clone.style.transformOrigin = 'top left';
          clone.style.width = `${width}px`;
          clone.style.height = `${height}px`;
          clone.style.margin = '0';
          clone.style.padding = '0';
          clone.style.overflow = 'hidden';
          clone.style.backgroundColor = 'transparent';
  
          document.body.appendChild(clone);
  
          domtoimage
  .toBlob(clone, {
    width: exportWidth,
    height: exportHeight,
    style: {
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                width: `${width}px`,
                height: `${height}px`,
                margin: 0,
                padding: 0,
                overflow: 'hidden',
                backgroundColor: 'transparent',
              },
              filter: node => node.tagName !== 'SCRIPT',
            })
            .then(blob => {
              const formData = new FormData();
              formData.append('cardImage', blob, `${title || 'card'}.png`);
          
              return axios.post('http://localhost:5000/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
              });
            })
            .then(res => {
              console.log('Upload successful:', res.data);
            })
            .catch(err => console.error('Export/upload failed:', err))
            .finally(() => {
              document.body.removeChild(clone);
            });
        }, 500);
      })
      .catch((err) => console.error('Fonts not loaded:', err));
  };
  
  

  return (
    <div style={{ padding: 20, fontFamily: 'serif' }}>
      <h1 style={{ fontFamily: 'Karma, serif' }}>Card Creator</h1>

      <input
        type="file"
        accept="image/*"
        onChange={e => setImageFile(e.target.files[0])}
      />

      <div style={{ margin: '10px 0' }}>
        <label>
          Offset X:
          <input
            type="range"
            min={-200}
            max={200}
            value={offsetX}
            onChange={e => setOffsetX(Number(e.target.value))}
          />
        </label>
        <label style={{ marginLeft: 20 }}>
          Offset Y:
          <input
            type="range"
            min={-200}
            max={200}
            value={offsetY}
            onChange={e => setOffsetY(Number(e.target.value))}
          />
        </label>
      </div>

      <label style={{ marginLeft: 20 }}>
  Illustration Size:
  <input
    type="range"
    min={0.5}
    max={2}
    step={0.05}
    value={imageScale}
    onChange={e => setImageScale(Number(e.target.value))}
  />
  <span>{Math.round(imageScale * 100)}%</span>
</label>

      <div style={{ display: 'flex', flexDirection: 'column', maxWidth: 400, margin: '0 auto' }}>
        <label>
          Title:
          <input value={title} onChange={e => setTitle(e.target.value)} />
        </label>
        <label>
          Subtitle:
          <input value={subtitle} onChange={e => setSubtitle(e.target.value)} />
        </label>
        <label>
          Description:
          <textarea value={description} onChange={e => setDescription(e.target.value)} />
        </label>
        <label>
          HP Cost:
          <input value={hpCost} onChange={e => setHpCost(e.target.value)} />
        </label>
        <label>
          SP Cost:
          <input value={spCost} onChange={e => setSpCost(e.target.value)} />
        </label>

        {/* Slider to control title font size */}
        <label>
          Title Font Size:
          <input
            type="range"
            min={30}
            max={100}
            value={titleFontSize}
            onChange={e => setTitleFontSize(Number(e.target.value))}
            style={{ marginTop: '10px', width: '100%' }}
          />
          <span>{titleFontSize}px</span>
        </label>

        {/* Slider to control title vertical position */}
        <label>
          Title Vertical Position:
          <input
            type="range"
            min={100}
            max={300}
            value={titlePositionY}
            onChange={e => setTitlePositionY(Number(e.target.value))}
            style={{ marginTop: '10px', width: '100%' }}
          />
          <span>{titlePositionY}px</span>
        </label>
      </div>

      {/* Toggle to switch between physical and magic cards */}
      <div style={{ marginTop: '20px' }}>
        <label>
          Card Type:
          <select
            value={cardType}
            onChange={e => setCardType(e.target.value)}
            style={{ marginLeft: '10px' }}
          >
            <option value="physical">Physical</option>
            <option value="magic">Magic</option>
          </select>
        </label>
      </div>

      <div
        ref={cardRef}
        style={{
          position: 'relative',
          width: 384,
          height: 617,
          backgroundImage: `url(/${cardType === 'magic' ? 'card-empty-magic.png' : 'card-empty.png'})`, // Use magic or physical background
          backgroundSize: 'cover',
          margin: '20px auto',
          overflow: 'hidden',
          backgroundColor: 'transparent'
        }}
      >
        {imageUrl && (
          <>
            <img
  src={imageUrl}
  alt="Card art"
  style={{
    position: 'absolute',
    top: `calc(50% + ${offsetY}px)`,
    left: `calc(50% + ${offsetX}px)`,
    transform: `translate(-50%, -50%) scale(${imageScale})`,
    transformOrigin: 'center center',
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
    pointerEvents: 'none'
  }}
/>
            <img
              src={`/${cardType === 'magic' ? 'card-mask-overlay-magic.png' : 'card-mask-overlay.png'}`} // Use magic or physical overlay
              alt="Card mask overlay"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none'
              }}
            />
          </>
        )}

        <div
          style={{
            position: 'absolute',
            bottom: `${titlePositionY}px`,
            width: '80%',
            left: '10%',
            textAlign: 'center',
            fontSize: `${titleFontSize}px`,
            fontFamily: 'Karma, serif',
            fontWeight: 600,
            color: 'black'
          }}
        >
          {title}
        </div>

        <div
          style={{
            position: 'absolute',
            top: '51.5px',
            left: '30%',
            width: '40%',
            textAlign: 'center',
            fontSize: '18px',
            fontFamily: 'Inria Serif, serif',
            fontStyle: 'italic',
            color: 'black'
          }}
        >
          {subtitle}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '40px',
            width: '80%',
            left: '10%',
            textAlign: 'center',
            fontSize: '22px',
            fontFamily: 'Inria Serif, serif',
            color: cardType === 'magic' ? 'white' : 'black', // Change color based on card type
            height: '140px',
            overflowY: 'auto'
          }}
          dangerouslySetInnerHTML={{ __html: description }}
        ></div>

        <div
          style={{
            position: 'absolute',
            top: '36px',
            left: '42px',
            width: '40px',
            textAlign: 'center',
            fontSize: '45px',
            fontFamily: 'Karma, serif',
            fontWeight: 600,
            color: 'red'
          }}
        >
          {hpCost}
        </div>

        <div
          style={{
            position: 'absolute',
            top: '36px',
            right: '42px',
            width: '40px',
            textAlign: 'center',
            fontSize: '45px',
            fontFamily: 'Karma, serif',
            fontWeight: 600,
            color: '#7633CF'
          }}
        >
          {spCost}
        </div>
      </div>

      <label style={{ display: 'block', marginTop: 20 }}>
  Export Scale: {exportScale}x
  <input
    type="range"
    min={1}
    max={5}
    step={0.1}
    value={exportScale}
    onChange={e => setExportScale(Number(e.target.value))}
    style={{ width: '100%' }}
  />
</label>

      <button
        onClick={handleSaveImage}
        style={{
          marginTop: 20,
          padding: '10px 20px',
          fontSize: '16px',
          cursor: 'pointer',
          fontFamily: 'Karma, serif'
        }}
      >
        Save as PNG
      </button>

      <h2>Gallery</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
  {gallery.map((img, i) => {
    console.log(`Rendering image with URL: ${img.url}`);  // Log each image URL
    return (
      <img
        key={i}
        src={img.url}  // Use Cloudinary URL directly
        alt={`Card ${i}`}
        style={{ width: 192, height: 308, objectFit: 'cover', border: '1px solid #ccc' }}
      />
    );
  })}
</div>

    </div>
    
    
  );
}

export default App;
