import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const saveIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>`;
const checkIconSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;

app.registerExtension({
    name: "Flex.ImageCompare",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name === "Flex Image Compare") {
            nodeType.prototype.onExecuted = function(message) {
                const self = this;
                
                // Clean up old widget to prevent duplicates
                if (this.widgets) {
                    const pos = this.widgets.findIndex((w) => w.name === "flex_ui_root");
                    if (pos !== -1) {
                        this.widgets[pos].onRemove?.();
                        this.widgets.splice(pos, 1);
                    }
                }

                // Main Container
                const container = document.createElement("div");
                container.style.cssText = "display:flex; flex-direction:column; width:100%; height:100%; background:#1a1a1a; overflow:hidden;";

                const imageList = message.bypassed_images || message.images || [];
                const prefix = message.prefix ? message.prefix[0] : "compare/comparison";
                if (imageList.length === 0) return;

                let imgAIndex = 0;
                let imgBIndex = Math.min(1, imageList.length - 1);
                let isVertical = false;
                let isDifference = false;
                let zoom = 1.0;
                let panX = 0, panY = 0;
                let sliderPos = 0.5;
                let thumbSize = 100;
                let autoFit = true; // Tracks if the image should scale with the node

                const imageUrls = imageList.map(img => 
                    api.apiURL(`/view?filename=${encodeURIComponent(img.filename)}&type=${img.type}&subfolder=${img.subfolder}`)
                );

                // API Call logic
                const saveToOutput = async (imgObj, btnElem) => {
                    btnElem.innerHTML = saveIconSVG;
                    btnElem.style.background = "#ff9900"; 
                    try {
                        const response = await api.fetchApi("/flex_compare/save", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ filename: imgObj.filename, prefix: prefix })
                        });
                        if (response.ok) {
                            btnElem.innerHTML = checkIconSVG;
                            btnElem.style.background = "#3574f0"; 
                        }
                    } catch(e) {
                        btnElem.textContent = "!";
                        btnElem.style.background = "#dc3545"; 
                    }
                    setTimeout(() => {
                        btnElem.innerHTML = saveIconSVG;
                        btnElem.style.background = "#444"; 
                    }, 2000);
                };

                // TOP SECTION
                const topSection = document.createElement("div");
                topSection.style.cssText = "display:flex; flex-direction:column; background:#252525; border-bottom:1px solid #333; flex-shrink:0;";
                
                const filmstrip = document.createElement("div");
                filmstrip.style.cssText = "display:flex; overflow-x:auto; gap:8px; padding:8px; justify-content:center; scrollbar-width: thin;";

                const renderFilmstrip = () => {
                    filmstrip.innerHTML = "";
                    imageUrls.forEach((url, i) => {
                        const wrapper = document.createElement("div");
                        const borderColor = (i === imgBIndex) ? "#5555ff" : (i === imgAIndex ? "#ff5555" : "#444");
                        wrapper.style.cssText = `display:flex; flex-direction:column; background:#111; border:2px solid ${borderColor}; min-width:${thumbSize}px; transition: border 0.2s;`;
                        
                        const img = new Image();
                        img.src = url;
                        img.style.cssText = `width:${thumbSize}px; height:${thumbSize}px; object-fit:contain; cursor:pointer;`;
                        img.onclick = () => {
                            if (i !== imgBIndex) { imgAIndex = imgBIndex; imgBIndex = i; renderFilmstrip(); updateImages(); }
                        };
                        
                        const bottomBar = document.createElement("div");
                        bottomBar.style.cssText = "display:flex; justify-content:space-between; align-items:center; background:#222; padding:2px 4px;";
                        
                        const label = document.createElement("div");
                        label.textContent = String.fromCharCode(65 + i);
                        label.style.cssText = "font-size:11px; color:#ccc; font-weight:bold;";

                        const saveBtn = document.createElement("button");
                        saveBtn.innerHTML = saveIconSVG;
                        saveBtn.style.cssText = "background:#444; color:white; border:none; border-radius:3px; padding:3px 6px; cursor:pointer; display:flex; align-items:center; justify-content:center; transition: background 0.2s;";
                        saveBtn.onclick = (e) => { e.stopPropagation(); saveToOutput(imageList[i], saveBtn); };

                        bottomBar.appendChild(label);
                        bottomBar.appendChild(saveBtn);
                        wrapper.appendChild(img);
                        wrapper.appendChild(bottomBar);
                        filmstrip.appendChild(wrapper);
                    });
                };

                // Thumbnail Size Controls
                const sliderContainer = document.createElement("div");
                sliderContainer.style.cssText = "display:flex; justify-content:center; align-items:center; padding:0 8px 8px 8px;";
                
                const sizeSlider = document.createElement("input");
                sizeSlider.type = "range"; sizeSlider.min = "60"; sizeSlider.max = "800"; sizeSlider.value = thumbSize;
                sizeSlider.style.width = "150px";
                sizeSlider.style.accentColor = "#3574f0";

                const updateThumbSize = (val) => {
                    thumbSize = Math.max(60, Math.min(800, val));
                    sizeSlider.value = thumbSize;
                    renderFilmstrip();
                };

                sizeSlider.oninput = (e) => updateThumbSize(e.target.value);
                
                // Wheel support for filmstrip (Horizontal Scroll + Ctrl/Zoom)
                filmstrip.onwheel = (e) => {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        updateThumbSize(Number(thumbSize) + (e.deltaY > 0 ? -15 : 15));
                    } else if (e.deltaY !== 0) {
                        e.preventDefault();
                        filmstrip.scrollLeft += e.deltaY;
                    }
                };
                
                sliderContainer.appendChild(sizeSlider);
                topSection.appendChild(filmstrip);
                topSection.appendChild(sliderContainer);
                container.appendChild(topSection);

                // CANVAS WRAPPER
                const canvasWrapper = document.createElement("div");
                canvasWrapper.style.cssText = "flex:1; display:flex; overflow:hidden; position:relative; min-height:200px;";
                
                const canvas = document.createElement("canvas");
                canvas.style.cssText = "background:#000; cursor:crosshair; width:100%; height:100%; display:block;";
                canvasWrapper.appendChild(canvas);
                container.appendChild(canvasWrapper);

                const ctx = canvas.getContext("2d");
                const imgA = new Image(); const imgB = new Image();

                const resetView = () => {
                    if (!imgA.naturalWidth || canvas.width === 0) return;
                    const scaleX = canvas.width / imgA.naturalWidth;
                    const scaleY = canvas.height / imgA.naturalHeight;
                    zoom = Math.min(scaleX, scaleY) * 0.98;
                    panX = 0; panY = 0;
                    autoFit = true; // Lock image sizing to node resizing
                    draw();
                };

                const draw = () => {
                    if (canvas.width === 0 || canvas.height === 0) return;
                    
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    if (!imgA.complete || !imgB.complete || !imgA.naturalWidth) return;

                    const drawLayer = (img, clipArea = null) => {
                        ctx.save();
                        if (clipArea) { ctx.beginPath(); ctx.rect(clipArea.x, clipArea.y, clipArea.w, clipArea.h); ctx.clip(); }
                        let dw = img.naturalWidth * zoom; let dh = img.naturalHeight * zoom;
                        const dx = (canvas.width - dw) / 2 + panX; const dy = (canvas.height - dh) / 2 + panY;
                        ctx.drawImage(img, dx, dy, dw, dh);
                        ctx.restore();
                    };

                    if (isDifference) {
                        drawLayer(imgA); 
                        ctx.globalCompositeOperation = "difference"; 
                        drawLayer(imgB); 
                        ctx.globalCompositeOperation = "source-over";
                    } else {
                        drawLayer(imgB);
                        const clip = isVertical ? { x:0, y:0, w:canvas.width, h:canvas.height * sliderPos } : { x:0, y:0, w:canvas.width * sliderPos, h:canvas.height };
                        drawLayer(imgA, clip);

                        ctx.strokeStyle = "rgba(128,128,128,0.8)"; ctx.lineWidth = 1; ctx.beginPath();
                        if (isVertical) { ctx.moveTo(0, canvas.height * sliderPos); ctx.lineTo(canvas.width, canvas.height * sliderPos); }
                        else { ctx.moveTo(canvas.width * sliderPos, 0); ctx.lineTo(canvas.width * sliderPos, canvas.height); }
                        ctx.stroke();

                        ctx.font = "bold 20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                        ctx.lineWidth = 3; ctx.strokeStyle = "black"; ctx.fillStyle = "white";
                        const labelA = String.fromCharCode(65 + imgAIndex); const labelB = String.fromCharCode(65 + imgBIndex);
                        
                        const padX = 25; const padY = 20;

                        if (isVertical) {
                            const lineY = canvas.height * sliderPos;
                            const safeX = canvas.width - padX - 10;
                            ctx.strokeText(labelA, safeX, lineY - padY); ctx.fillText(labelA, safeX, lineY - padY);
                            ctx.strokeText(labelB, safeX, lineY + padY); ctx.fillText(labelB, safeX, lineY + padY);
                        } else {
                            const lineX = canvas.width * sliderPos; 
                            const safeY = canvas.height - padY - 10;
                            ctx.strokeText(labelA, lineX - padX, safeY); ctx.fillText(labelA, lineX - padX, safeY);
                            ctx.strokeText(labelB, lineX + padX, safeY); ctx.fillText(labelB, lineX + padX, safeY);
                        }
                    }
                };

                let isPanning = false;

                canvas.onmousemove = (e) => {
                    if (isPanning) { 
                        panX += e.movementX; panY += e.movementY; 
                    } else if (!isDifference) {
                        const rect = canvas.getBoundingClientRect();
                        if (rect.width > 0 && rect.height > 0) {
                            sliderPos = isVertical ? (e.clientY - rect.top) / rect.height : (e.clientX - rect.left) / rect.width;
                        }
                    }
                    draw();
                };

                canvas.onmouseleave = () => { if (!isDifference && !isPanning) { sliderPos = 0.5; draw(); } };
                
                canvas.onwheel = (e) => { 
                    e.preventDefault(); 
                    autoFit = false; // User zoomed manually, break the auto-fit behavior
                    zoom = Math.min(Math.max(zoom * (e.deltaY > 0 ? 0.9 : 1.1), 0.05), 20); 
                    draw(); 
                };
                
                canvas.onmousedown = (e) => { 
                    if(e.button === 0) {
                        isPanning = true; 
                        autoFit = false; // User panned manually, break the auto-fit behavior
                    }
                };
                window.addEventListener("mouseup", () => isPanning = false);

                const updateImages = () => {
                    imgA.src = imageUrls[imgAIndex]; imgB.src = imageUrls[imgBIndex];
                    imgA.onload = () => { if (autoFit) resetView(); else draw(); };
                    imgB.onload = draw;
                };

                const ro = new ResizeObserver((entries) => {
                    for (let entry of entries) {
                        const { width, height } = entry.contentRect;
                        if (width > 0 && height > 0) {
                            canvas.width = width;
                            canvas.height = height;
                            // If autoFit is true, auto-scale the image. If false, retain user's custom zoom.
                            if (autoFit && imgA.naturalWidth) resetView(); else draw();
                        }
                    }
                });
                ro.observe(canvasWrapper);

                // FOOTER SECTION
                const footer = document.createElement("div");
                footer.style.cssText = "display:flex; gap:4px; padding:6px; background:#252525; flex-shrink:0; border-top:1px solid #333;";
                const btn = (txt, fn) => {
                    const b = document.createElement("button"); b.textContent = txt;
                    b.style.cssText = "flex:1; padding:8px; font-size:12px; font-weight:bold; cursor:pointer; background:#444; color:white; border:none; border-radius:3px; transition: background 0.2s;";
                    b.onmouseover = () => b.style.background = "#555";
                    b.onmouseout = () => { if (b.textContent !== "Saved All!") b.style.background = "#444"; }
                    b.onclick = fn; return b;
                };
                
                footer.appendChild(btn("Reset View", resetView));
                footer.appendChild(btn("Flip Axis", () => { isVertical = !isVertical; draw(); }));
                footer.appendChild(btn("Toggle Diff", () => { isDifference = !isDifference; draw(); }));
                
                const saveAllBtn = btn("Save All", async () => {
                    saveAllBtn.textContent = "Saving...";
                    saveAllBtn.style.background = "#ff9900";
                    for (const img of imageList) await saveToOutput(img, document.createElement("div"));
                    saveAllBtn.textContent = "Saved All!";
                    saveAllBtn.style.background = "#3574f0";
                    setTimeout(() => { saveAllBtn.textContent = "Save All"; saveAllBtn.style.background = "#444"; }, 2000);
                });
                footer.appendChild(saveAllBtn);
                
                container.appendChild(footer);

                renderFilmstrip();
                updateImages();

                this.addDOMWidget("flex_ui_root", "ui", container, { serialize: false, hideOnZoom: false });
                setTimeout(() => self.setSize([Math.max(self.size[0], 600), Math.max(self.size[1], 700)]), 50);
            };
        }
    }
});