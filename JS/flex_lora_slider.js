import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

let availableLoras = [];
let flexConfigs = { loras: {}, presets: {} };

// Fetch standard LoRA list
api.fetchApi("/flex_pack/loras").then(res => res.json()).then(data => {
    availableLoras = ["None"].concat(data.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())));
});

// Fetch our Configs/Presets globally so combo-boxes have access immediately
api.fetchApi("/flex_pack/configs").then(res => res.json()).then(data => {
    flexConfigs = data;
    if (!flexConfigs.loras) flexConfigs.loras = {};
    if (!flexConfigs.presets) flexConfigs.presets = {};
    
    // Update any nodes that were initialized before the fetch returned
    const nodes = (app.graph && app.graph._nodes) ? app.graph._nodes.filter(n => n.comfyClass === "FlexLoraSlider") : [];
    nodes.forEach(n => {
        if (n.presetCombo) {
            n.presetCombo.options.values = ["None"].concat(Object.keys(flexConfigs.presets));
        }
    });
});

function hideWidget(w) {
    w.hidden = true;
    w.computeSize = () => [0, 0];
    w.draw = () => {};
}

function showConfigModal(config, onSave) {
    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
        position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
        backgroundColor: "rgba(0,0,0,0.7)", display: "flex", justifyContent: "center",
        alignItems: "center", zIndex: "10000", fontFamily: "sans-serif"
    });

    const modal = document.createElement("div");
    Object.assign(modal.style, {
        backgroundColor: "#2b2b2b", color: "#ddd", padding: "20px", borderRadius: "8px",
        width: "600px", border: "1px solid #444", boxShadow: "0 4px 10px rgba(0,0,0,0.5)"
    });

    modal.innerHTML = `
        <h2 style="margin-top:0; color:#fff;">Configure LoRA</h2>
        
        <div style="margin-bottom:15px; padding-bottom:15px; border-bottom:1px solid #444;">
            <div style="position:relative; margin-bottom:10px;">
                <label style="display:block; font-size:12px; margin-bottom:4px; color:#4CAF50;">Search Saved Configs (Display Name)</label>
                <input type="text" id="cc-saved-search" autocomplete="off" placeholder="Search configured LoRAs..." style="width:100%; padding:6px; background:#1e1e1e; color:#fff; border:1px solid #555; box-sizing:border-box;">
                <div id="cc-saved-dropdown" style="display:none; position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; background:#222; border:1px solid #555; border-top:none; z-index:10002; box-sizing:border-box; box-shadow: 0 4px 6px rgba(0,0,0,0.5);">
                </div>
            </div>
            <div style="position:relative;">
                <label style="display:block; font-size:12px; margin-bottom:4px; color:#aaa;">Search All LoRA Files</label>
                <input type="text" id="cc-lora" value="${config.lora}" autocomplete="off" placeholder="Search raw filenames..." style="width:100%; padding:6px; background:#1e1e1e; color:#fff; border:1px solid #555; box-sizing:border-box;">
                <div id="cc-lora-dropdown" style="display:none; position:absolute; top:100%; left:0; width:100%; max-height:200px; overflow-y:auto; background:#222; border:1px solid #555; border-top:none; z-index:10001; box-sizing:border-box; box-shadow: 0 4px 6px rgba(0,0,0,0.5);">
                </div>
            </div>
        </div>

        <div style="display:flex; gap:10px; margin-bottom:10px;">
            <div style="flex:1;">
                <label style="display:block; font-size:12px; margin-bottom:4px;">Display Name</label>
                <input type="text" id="cc-name" value="${config.display_name || ""}" placeholder="e.g., Detail Enhancer" style="width:100%; padding:6px; background:#1e1e1e; color:#fff; border:1px solid #555; box-sizing:border-box;">
            </div>
            <div style="flex:1;">
                <label style="display:block; font-size:12px; margin-bottom:4px;">Keywords (Output to Prompt)</label>
                <input type="text" id="cc-keywords" value="${config.keywords || ""}" placeholder="e.g., masterpiece, best quality" style="width:100%; padding:6px; background:#1e1e1e; color:#fff; border:1px solid #555; box-sizing:border-box;">
            </div>
        </div>

        <div style="margin-bottom:10px;">
            <label style="display:block; font-size:12px; margin-bottom:4px;">Notes / URL</label>
            <textarea id="cc-notes" rows="2" placeholder="Save notes or a CivitAI URL here..." style="width:100%; padding:6px; background:#1e1e1e; color:#fff; border:1px solid #555; box-sizing:border-box; resize:vertical;">${config.notes || ""}</textarea>
        </div>

        <div style="display:flex; gap:10px; margin-bottom:10px;">
            <div style="flex:1;">
                <label style="display:block; font-size:12px; margin-bottom:4px;">Strength Min</label>
                <input type="number" id="cc-min" value="${config.min_val}" step="0.1" style="width:100%; padding:6px; background:#1e1e1e; color:#fff; border:1px solid #555; box-sizing:border-box;">
            </div>
            <div style="flex:1;">
                <label style="display:block; font-size:12px; margin-bottom:4px;">Min Label</label>
                <input type="text" id="cc-min-label" value="${config.min_label}" style="width:100%; padding:6px; background:#1e1e1e; color:#fff; border:1px solid #555; box-sizing:border-box;">
            </div>
        </div>

        <div style="display:flex; gap:10px; margin-bottom:20px;">
            <div style="flex:1;">
                <label style="display:block; font-size:12px; margin-bottom:4px;">Strength Max</label>
                <input type="number" id="cc-max" value="${config.max_val}" step="0.1" style="width:100%; padding:6px; background:#1e1e1e; color:#fff; border:1px solid #555; box-sizing:border-box;">
            </div>
            <div style="flex:1;">
                <label style="display:block; font-size:12px; margin-bottom:4px;">Max Label</label>
                <input type="text" id="cc-max-label" value="${config.max_label}" style="width:100%; padding:6px; background:#1e1e1e; color:#fff; border:1px solid #555; box-sizing:border-box;">
            </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button id="cc-cancel" style="padding:8px 16px; background:#444; color:#fff; border:none; border-radius:4px; cursor:pointer;">Cancel</button>
            <button id="cc-save" style="padding:8px 16px; background:#4CAF50; color:#fff; border:none; border-radius:4px; cursor:pointer;">Save</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const loraInput = document.getElementById("cc-lora");
    const loraDropdown = document.getElementById("cc-lora-dropdown");
    const savedInput = document.getElementById("cc-saved-search");
    const savedDropdown = document.getElementById("cc-saved-dropdown");

    const configuredLorasArray = Object.keys(flexConfigs.loras)
        .filter(k => flexConfigs.loras[k].display_name)
        .map(k => ({ file: k, name: flexConfigs.loras[k].display_name }));
        
    configuredLorasArray.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    configuredLorasArray.forEach(item => {
        const l = item.file;
        const savedData = flexConfigs.loras[l];
        const opt = document.createElement("div");
        opt.textContent = `${savedData.display_name}  (${l})`;
        opt.style.padding = "8px 6px";
        opt.style.cursor = "pointer";
        opt.style.borderBottom = "1px solid #333";
        opt.style.fontSize = "12px";
        opt.onmouseover = () => opt.style.backgroundColor = "#444";
        opt.onmouseout = () => opt.style.backgroundColor = "transparent";
        opt.onclick = () => {
            savedInput.value = savedData.display_name;
            loraInput.value = l; 
            savedDropdown.style.display = "none";
            loraDropdown.style.display = "none";
            loraInput.dispatchEvent(new Event("change")); 
        };
        savedDropdown.appendChild(opt);
    });

    availableLoras.forEach(l => {
        const opt = document.createElement("div");
        opt.textContent = l;
        opt.style.padding = "8px 6px";
        opt.style.cursor = "pointer";
        opt.style.borderBottom = "1px solid #333";
        opt.style.fontSize = "12px";
        opt.onmouseover = () => opt.style.backgroundColor = "#444";
        opt.onmouseout = () => opt.style.backgroundColor = "transparent";
        opt.onclick = () => {
            loraInput.value = l;
            savedInput.value = ""; 
            loraDropdown.style.display = "none";
            savedDropdown.style.display = "none";
            loraInput.dispatchEvent(new Event("change")); 
        };
        loraDropdown.appendChild(opt);
    });

    savedInput.onfocus = () => {
        savedDropdown.style.display = "block";
        loraDropdown.style.display = "none";
        Array.from(savedDropdown.children).forEach(c => c.style.display = "block");
    };

    loraInput.onfocus = () => {
        loraDropdown.style.display = "block";
        savedDropdown.style.display = "none";
        Array.from(loraDropdown.children).forEach(c => c.style.display = "block");
    };

    savedInput.oninput = (e) => {
        savedDropdown.style.display = "block";
        const filter = e.target.value.toLowerCase();
        Array.from(savedDropdown.children).forEach(child => {
            child.style.display = child.textContent.toLowerCase().includes(filter) ? "block" : "none";
        });
    };

    loraInput.oninput = (e) => {
        loraDropdown.style.display = "block";
        const filter = e.target.value.toLowerCase();
        Array.from(loraDropdown.children).forEach(child => {
            child.style.display = child.textContent.toLowerCase().includes(filter) ? "block" : "none";
        });
    };

    overlay.addEventListener("mousedown", (e) => {
        if (e.target !== loraInput && e.target !== loraDropdown && e.target.parentNode !== loraDropdown &&
            e.target !== savedInput && e.target !== savedDropdown && e.target.parentNode !== savedDropdown) {
            loraDropdown.style.display = "none";
            savedDropdown.style.display = "none";
        }
    });

    loraInput.addEventListener("change", (e) => {
        const lora = e.target.value;
        const saved = flexConfigs.loras[lora]; 
        if (saved) {
            document.getElementById("cc-name").value = saved.display_name || "";
            document.getElementById("cc-keywords").value = saved.keywords || "";
            document.getElementById("cc-notes").value = saved.notes || "";
            document.getElementById("cc-min").value = saved.min_val || -2.0;
            document.getElementById("cc-max").value = saved.max_val || 2.0;
            document.getElementById("cc-min-label").value = saved.min_label || "Less";
            document.getElementById("cc-max-label").value = saved.max_label || "More";
        }
    });

    document.getElementById("cc-cancel").onclick = () => document.body.removeChild(overlay);
    
    document.getElementById("cc-save").onclick = async () => {
        const newConfig = {
            lora: loraInput.value || "None",
            display_name: document.getElementById("cc-name").value,
            keywords: document.getElementById("cc-keywords").value,
            notes: document.getElementById("cc-notes").value,
            min_val: parseFloat(document.getElementById("cc-min").value) || -2.0,
            max_val: parseFloat(document.getElementById("cc-max").value) || 2.0,
            min_label: document.getElementById("cc-min-label").value,
            max_label: document.getElementById("cc-max-label").value,
            active: config.active
        };

        if (newConfig.lora !== "None") {
            try {
                await api.fetchApi("/flex_pack/configs/lora", {
                    method: "POST",
                    body: JSON.stringify(newConfig),
                    headers: { "Content-Type": "application/json" }
                });
                flexConfigs.loras[newConfig.lora] = newConfig;
            } catch (e) { 
                console.error("Flex Pack: Error saving lora config to backend", e);
            }
        }

        onSave(newConfig);
        document.body.removeChild(overlay);
    };
}

const COMBO_PRESET = "Stack Preset";
const BTN_ADD = "+ Add LoRA";

function addStandardWidgets(node) {
    if (!node.widgets) node.widgets = [];

    // 1. Dropdown for Stack Preset
    if (!node.widgets.find(w => w.name === COMBO_PRESET)) {
        node.presetCombo = node.addWidget("combo", COMBO_PRESET, "None", (val) => {
            if (val === "None") return;
            const preset = flexConfigs.presets[val];
            if (!preset) return;

            const toRemove = node.widgets.filter(w => w.name && (w.name.startsWith("config_") || w.name.startsWith("val_") || w.name.startsWith("lora_ui_")));
            toRemove.forEach(w => {
                const idx = node.widgets.indexOf(w);
                if (idx !== -1) node.widgets.splice(idx, 1);
            });

            preset.forEach(p => {
                const loraId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                node.addLoraRow(loraId, p.lora, p.value, p.active);
            });

            node.setSize(node.computeSize());
            node.setDirtyCanvas(true, true);
        }, { values: ["None"].concat(Object.keys(flexConfigs.presets || {})) });
    }

    // 2. Custom Toolbar (Replaces the 4 stacked buttons)
    if (!node.widgets.find(w => w.name === "custom_toolbar")) {
        const toolbarWidget = {
            type: "custom_toolbar",
            name: "custom_toolbar",
            computeSize: function() { return [540, 26]; }, // slightly thinner height for inline tools
            draw: function(ctx, node, widget_width, y, H) {
                const w = widget_width / 4;
                
                ctx.font = "12px sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const centerY = y + (H / 2);

                const buttons = ["💾 Save Stack", "🗑️ Clear", "🔄 Reset", "🎲 Rand"];
                for(let i=0; i<4; i++) {
                    // Button Background
                    ctx.fillStyle = "#333";
                    ctx.fillRect((i * w) + 2, y + 2, w - 4, H - 4);
                    // Label Text
                    ctx.fillStyle = "#ddd";
                    ctx.fillText(buttons[i], (i * w) + (w / 2), centerY);
                }
                ctx.textBaseline = "alphabetic"; // restore default
            },
            mouse: function(event, pos, node) {
                const localX = pos[0];
                const isClick = event.type === "pointerdown" || event.type === "mousedown";
                if (!isClick) return false;

                const w = node.size[0] / 4;
                const idx = Math.floor(localX / w);

                if (idx === 0) { // 💾 Save
                    const name = prompt("Enter a name for this preset stack:");
                    if (!name) return true;

                    const presetData = [];
                    const configs = node.widgets.filter(w => w.name && w.name.startsWith("config_"));
                    
                    configs.forEach(cw => {
                        const id = cw.name.split("_")[1];
                        const conf = JSON.parse(cw.value);
                        const vw = node.widgets.find(w => w.name === `val_${id}`);
                        
                        if (conf.lora && conf.lora !== "None") {
                            presetData.push({
                                lora: conf.lora,
                                value: vw ? vw.value : 0,
                                active: conf.active
                            });
                        }
                    });

                    if (presetData.length === 0) {
                        alert("No configured LoRAs to save in stack.");
                        return true;
                    }

                    api.fetchApi("/flex_pack/configs/preset", {
                        method: "POST",
                        body: JSON.stringify({ name: name, data: presetData }),
                        headers: { "Content-Type": "application/json" }
                    }).then(() => {
                        flexConfigs.presets[name] = presetData;
                        node.presetCombo.options.values = ["None"].concat(Object.keys(flexConfigs.presets));
                        node.presetCombo.value = name;
                        node.setDirtyCanvas(true, true);
                    }).catch(e => {
                        console.error("Flex Pack: Error saving preset", e);
                        alert("Failed to save preset to backend.");
                    });
                    return true;
                }
                else if (idx === 1) { // 🗑️ Clear
                    const toRemove = node.widgets.filter(w => w.name && (w.name.startsWith("config_") || w.name.startsWith("val_") || w.name.startsWith("lora_ui_")));
                    toRemove.forEach(w => {
                        const idx = node.widgets.indexOf(w);
                        if (idx !== -1) node.widgets.splice(idx, 1);
                    });
                    if (node.presetCombo) node.presetCombo.value = "None";
                    node.setSize(node.computeSize());
                    node.setDirtyCanvas(true, true);
                    return true;
                }
                else if (idx === 2) { // 🔄 Reset
                    node.widgets.forEach(w => {
                        if (w.name && w.name.startsWith("val_")) w.value = 0;
                    });
                    node.setDirtyCanvas(true, true);
                    return true;
                }
                else if (idx === 3) { // 🎲 Rand
                    node.widgets.forEach(w => {
                        if (w.name && w.name.startsWith("val_")) {
                            w.value = Math.floor(Math.random() * 201) - 100;
                        }
                    });
                    node.setDirtyCanvas(true, true);
                    return true;
                }
                return false;
            }
        };
        node.widgets.push(toolbarWidget);
    }
}


app.registerExtension({
    name: "Comfy.FlexPack.LoraSlider",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        if (nodeData.name === "FlexLoraSlider") {
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function() {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;
                
                addStandardWidgets(this);
                this.addWidget("button", BTN_ADD, "add", () => {
                    this.addLoraRow(Date.now().toString() + Math.random().toString(36).substr(2, 5));
                });
                
                return r;
            };

            const orgOnConfigure = nodeType.prototype.onConfigure;
            nodeType.prototype.onConfigure = function(info) {
                if (this.widgets) {
                    this.widgets = this.widgets.filter(w => {
                        // Stripping layout tools to completely rebuild them structurally
                        if ([COMBO_PRESET, "custom_toolbar", BTN_ADD].includes(w.name)) return false;
                        if (w.type === "custom_lora_ui") return false;
                        if (w.name && w.name.startsWith("config_")) return false;
                        if (w.name && w.name.startsWith("val_")) return false;
                        return true; 
                    });
                } else {
                    this.widgets = [];
                }

                addStandardWidgets(this);

                if (info && info.widgets_values) {
                    for (let i = 0; i < info.widgets_values.length; i++) {
                        const val = info.widgets_values[i];
                        
                        if (typeof val === "string" && val.includes('"lora":') && val.includes('"display_name":')) {
                            try {
                                const loraId = Date.now().toString() + Math.random().toString(36).substr(2, 5);
                                
                                const confW = this.addWidget("string", `config_${loraId}`, val, () => {});
                                hideWidget(confW);
                                
                                const sliderVal = info.widgets_values[i + 1] || 0;
                                const valW = this.addWidget("number", `val_${loraId}`, sliderVal, () => {});
                                hideWidget(valW);

                                this.buildLoraUI(loraId);
                                i++; 
                            } catch (e) {
                                console.error("FlexPack: Error rebuilding row", e);
                            }
                        }
                    }
                }

                if (!this.widgets.find(w => w.name === BTN_ADD)) {
                    this.addWidget("button", BTN_ADD, "add", () => {
                        this.addLoraRow(Date.now().toString() + Math.random().toString(36).substr(2, 5));
                    });
                }

                if (orgOnConfigure) {
                    orgOnConfigure.apply(this, arguments);
                }
                
                this.setSize(this.computeSize());
                this.setDirtyCanvas(true, true);
            };

            nodeType.prototype.addLoraRow = function(loraId, presetLora = "None", presetVal = 0, presetActive = true) {
                
                let confObj = {
                    lora: presetLora, display_name: "", keywords: "", notes: "", 
                    min_val: -2.0, max_val: 2.0, min_label: "Less", max_label: "More", active: presetActive
                };
                
                if (presetLora !== "None" && flexConfigs.loras && flexConfigs.loras[presetLora]) {
                    confObj = { ...flexConfigs.loras[presetLora], active: presetActive };
                }

                let btnWidget = null;
                if (this.widgets) {
                    const btnIdx = this.widgets.findIndex(w => w.name === BTN_ADD);
                    if (btnIdx !== -1) {
                        btnWidget = this.widgets.splice(btnIdx, 1)[0];
                    }
                }

                const confW = this.addWidget("string", `config_${loraId}`, JSON.stringify(confObj), () => {});
                hideWidget(confW);
                
                const valW = this.addWidget("number", `val_${loraId}`, presetVal, () => {});
                hideWidget(valW);

                this.buildLoraUI(loraId);

                if (btnWidget) {
                    this.widgets.push(btnWidget);
                }

                this.setSize(this.computeSize());
                this.setDirtyCanvas(true, true);
            };

            nodeType.prototype.buildLoraUI = function(loraId) {
                if (this.widgets && this.widgets.find(w => w.name === `lora_ui_${loraId}`)) return;

                const customWidget = {
                    type: "custom_lora_ui",
                    name: `lora_ui_${loraId}`,
                    loraId: loraId,
                    value: 0,
                    computeSize: function() { return [500, 30]; },
                    draw: function(ctx, node, widget_width, y, H) {
                        this.last_y = y;

                        const confWidget = node.widgets.find(w => w.name === `config_${this.loraId}`);
                        if (!confWidget) return;
                        const conf = JSON.parse(confWidget.value);
                        
                        const valWidget = node.widgets.find(w => w.name === `val_${this.loraId}`);
                        const currentVal = valWidget ? valWidget.value : 0;

                        const centerY = y + 15;

                        ctx.fillStyle = conf.active ? "#4CAF50" : "#555";
                        ctx.fillRect(10, centerY - 7, 14, 14);

                        ctx.font = "14px sans-serif";
                        ctx.textAlign = "center";
                        ctx.fillStyle = "#aaa";
                        ctx.fillText("⬆️", widget_width - 95, centerY + 4);
                        ctx.fillText("⬇️", widget_width - 75, centerY + 4);
                        ctx.fillText("🎲", widget_width - 55, centerY + 4);
                        ctx.fillText("⚙️", widget_width - 35, centerY + 4);
                        ctx.fillText("❌", widget_width - 15, centerY + 4);

                        ctx.font = "10px sans-serif";
                        const sliderBarWidth = 120;
                        const labelSpace = 80; 

                        const sliderX = widget_width - 315;
                        const sliderW = sliderBarWidth;

                        ctx.textAlign = "left";
                        let displayMax = conf.max_label || "";
                        if (ctx.measureText(displayMax).width > labelSpace) {
                            while (displayMax.length > 0 && ctx.measureText(displayMax + "...").width > labelSpace) {
                                displayMax = displayMax.slice(0, -1);
                            }
                            displayMax += "...";
                        }
                        ctx.fillText(displayMax, sliderX + sliderW + 8, centerY + 3);

                        ctx.textAlign = "right";
                        let displayMin = conf.min_label || "";
                        if (ctx.measureText(displayMin).width > labelSpace) {
                            while (displayMin.length > 0 && ctx.measureText(displayMin + "...").width > labelSpace) {
                                displayMin = displayMin.slice(0, -1);
                            }
                            displayMin += "...";
                        }
                        ctx.fillText(displayMin, sliderX - 8, centerY + 3);

                        ctx.fillStyle = "#222";
                        ctx.fillRect(sliderX, centerY - 4, sliderW, 8);

                        const centerOffset = sliderW / 2;
                        const centerX = sliderX + centerOffset;
                        
                        ctx.fillStyle = conf.active ? "#3498db" : "#555";
                        
                        if (currentVal > 0) {
                            const fillW = (currentVal / 100) * centerOffset;
                            ctx.fillRect(centerX, centerY - 4, fillW, 8);
                        } else if (currentVal < 0) {
                            const fillW = (Math.abs(currentVal) / 100) * centerOffset;
                            ctx.fillRect(centerX - fillW, centerY - 4, fillW, 8);
                        }

                        ctx.fillStyle = "#fff";
                        ctx.textAlign = "center";
                        ctx.fillText(currentVal.toString(), centerX, centerY + 3);

                        ctx.font = "12px sans-serif";
                        const snapValues = [-100, -75, -50, -25, 0, 25, 50, 75, 100];
                        snapValues.forEach(val => {
                            const pct = (val + 100) / 200;
                            const cx = sliderX + (pct * sliderW);
                            ctx.fillStyle = (val === currentVal && conf.active) ? "#3498db" : (conf.active ? "#888" : "#444");
                            ctx.fillText("^", cx, centerY + 14);
                        });

                        const titleStart = 30;
                        const maxTitleSpace = (sliderX - 8 - labelSpace) - titleStart - 10;
                        const title = conf.display_name || (conf.lora !== "None" ? conf.lora.split('\\').pop().split('/').pop() : "Unconfigured LoRA");
                        
                        ctx.fillStyle = conf.active ? "#fff" : "#888";
                        ctx.font = "bold 12px sans-serif";
                        ctx.textAlign = "left";
                        
                        let displayTitle = title;
                        if (ctx.measureText(displayTitle).width > maxTitleSpace) {
                            while (displayTitle.length > 0 && ctx.measureText(displayTitle + "...").width > maxTitleSpace) {
                                displayTitle = displayTitle.slice(0, -1);
                            }
                            displayTitle += "...";
                        }
                        ctx.fillText(displayTitle, titleStart, centerY + 4);
                    },
                    mouse: function(event, pos, node) {
                        const localX = pos[0];
                        const localY = pos[1]; 
                        const widgetY = this.last_y || 0; 

                        const isClick = event.type === "pointerdown" || event.type === "mousedown";
                        const isDrag = event.type === "pointermove" || event.type === "mousemove";
                        
                        const confWidget = node.widgets.find(w => w.name === `config_${this.loraId}`);
                        const valWidget = node.widgets.find(w => w.name === `val_${this.loraId}`);
                        if (!confWidget || !valWidget) return false;
                        const conf = JSON.parse(confWidget.value);

                        if (isClick) {
                            if (localX >= 0 && localX <= 30) {
                                conf.active = !conf.active;
                                confWidget.value = JSON.stringify(conf);
                                node.setDirtyCanvas(true, true);
                                return true;
                            }

                            if (localX >= node.size[0] - 105 && localX < node.size[0] - 85) {
                                const loras = [];
                                let curr = null, layoutTop = [], layoutBot = [];
                                for(let i=0; i < node.widgets.length; i++) {
                                    const w = node.widgets[i];
                                    if ([COMBO_PRESET, "custom_toolbar"].includes(w.name)) { layoutTop.push(w); continue; }
                                    if (w.name === BTN_ADD) { layoutBot.push(w); continue; }
                                    if (w.name && w.name.startsWith("config_")) {
                                        curr = { config: w, val: null, ui: null };
                                        loras.push(curr);
                                    } else if (w.name && w.name.startsWith("val_") && curr) {
                                        curr.val = w;
                                    } else if (w.name && w.name.startsWith("lora_ui_") && curr) {
                                        curr.ui = w;
                                    }
                                }
                                const lIdx = loras.findIndex(l => l.ui && l.ui.loraId === this.loraId);
                                if (lIdx > 0) {
                                    const temp = loras[lIdx];
                                    loras[lIdx] = loras[lIdx - 1];
                                    loras[lIdx - 1] = temp;
                                    node.widgets = [...layoutTop];
                                    for(const l of loras) node.widgets.push(l.config, l.val, l.ui);
                                    node.widgets = node.widgets.concat(layoutBot);
                                    node.setDirtyCanvas(true, true);
                                }
                                return true;
                            }

                            if (localX >= node.size[0] - 85 && localX < node.size[0] - 65) {
                                const loras = [];
                                let curr = null, layoutTop = [], layoutBot = [];
                                for(let i=0; i < node.widgets.length; i++) {
                                    const w = node.widgets[i];
                                    if ([COMBO_PRESET, "custom_toolbar"].includes(w.name)) { layoutTop.push(w); continue; }
                                    if (w.name === BTN_ADD) { layoutBot.push(w); continue; }
                                    if (w.name && w.name.startsWith("config_")) {
                                        curr = { config: w, val: null, ui: null };
                                        loras.push(curr);
                                    } else if (w.name && w.name.startsWith("val_") && curr) {
                                        curr.val = w;
                                    } else if (w.name && w.name.startsWith("lora_ui_") && curr) {
                                        curr.ui = w;
                                    }
                                }
                                const lIdx = loras.findIndex(l => l.ui && l.ui.loraId === this.loraId);
                                if (lIdx !== -1 && lIdx < loras.length - 1) {
                                    const temp = loras[lIdx];
                                    loras[lIdx] = loras[lIdx + 1];
                                    loras[lIdx + 1] = temp;
                                    node.widgets = [...layoutTop];
                                    for(const l of loras) node.widgets.push(l.config, l.val, l.ui);
                                    node.widgets = node.widgets.concat(layoutBot);
                                    node.setDirtyCanvas(true, true);
                                }
                                return true;
                            }

                            if (localX >= node.size[0] - 65 && localX < node.size[0] - 45) {
                                valWidget.value = Math.floor(Math.random() * 201) - 100;
                                node.setDirtyCanvas(true, true);
                                return true;
                            }
                            
                            if (localX >= node.size[0] - 45 && localX < node.size[0] - 25) {
                                showConfigModal(conf, (newConfig) => {
                                    confWidget.value = JSON.stringify(newConfig);
                                    node.setDirtyCanvas(true, true);
                                });
                                return true;
                            }

                            if (localX >= node.size[0] - 25) {
                                setTimeout(() => {
                                    const wConfig = node.widgets.find(w => w.name === `config_${this.loraId}`);
                                    const wVal = node.widgets.find(w => w.name === `val_${this.loraId}`);
                                    const wUI = node.widgets.find(w => w.name === `lora_ui_${this.loraId}`);
                                    if (wUI) node.removeWidget(wUI);
                                    if (wVal) node.removeWidget(wVal);
                                    if (wConfig) node.removeWidget(wConfig);
                                    node.setSize(node.computeSize());
                                    node.setDirtyCanvas(true, true);
                                }, 10);
                                return true;
                            }
                        }

                        const sliderBarWidth = 120;
                        const labelSpace = 80;
                        const sliderX = node.size[0] - 315;
                        const sliderW = sliderBarWidth;

                        const minLabelRight = sliderX - 8;
                        const minLabelLeft = minLabelRight - labelSpace;
                        const maxLabelLeft = sliderX + sliderW + 8;
                        const maxLabelRight = maxLabelLeft + labelSpace;

                        if (isClick && localX >= minLabelLeft && localX <= minLabelRight) {
                            let val = parseInt(valWidget.value) || 0;
                            valWidget.value = Math.max(-100, val - 5);
                            node.setDirtyCanvas(true, true);
                            return true;
                        }
                        
                        if (isClick && localX >= maxLabelLeft && localX <= maxLabelRight) {
                            let val = parseInt(valWidget.value) || 0;
                            valWidget.value = Math.min(100, val + 5);
                            node.setDirtyCanvas(true, true);
                            return true;
                        }

                        if (isClick && localY >= widgetY + 17 && localX >= sliderX - 10 && localX <= sliderX + sliderW + 10) {
                            const snapValues = [-100, -75, -50, -25, 0, 25, 50, 75, 100];
                            let snapped = false;
                            for (let sVal of snapValues) {
                                const cx = sliderX + (((sVal + 100) / 200) * sliderW);
                                if (Math.abs(localX - cx) <= 6) { 
                                    valWidget.value = sVal;
                                    node.setDirtyCanvas(true, true);
                                    snapped = true;
                                    break;
                                }
                            }
                            if (snapped) return true;
                        }

                        if (localX >= sliderX - 10 && localX <= sliderX + sliderW + 10) {
                            if (isClick || isDrag) {
                                let pct = (localX - sliderX) / sliderW;
                                let val = Math.round((pct * 200) - 100);
                                val = Math.max(-100, Math.min(100, val));
                                valWidget.value = val;
                                node.setDirtyCanvas(true, true);
                                return true; 
                            }
                        }
                        return false;
                    }
                };
                this.widgets.push(customWidget);
            };

            const computeSize = nodeType.prototype.computeSize;
            nodeType.prototype.computeSize = function() {
                const size = computeSize ? computeSize.apply(this, arguments) : [540, 50];
                let customHeight = 0;
                if (this.widgets) {
                    for(const w of this.widgets) {
                        if (w.hidden) continue;
                        if (w.type === "custom_lora_ui") customHeight += 30; 
                        else if (w.type === "custom_toolbar") customHeight += 28; // Toolbar height footprint
                        else customHeight += LiteGraph.NODE_WIDGET_HEIGHT + 4;
                    }
                }
                size[0] = Math.max(size[0], 540); 
                size[1] = Math.max(size[1], customHeight + 40);
                return size;
            };
        }
    }
});