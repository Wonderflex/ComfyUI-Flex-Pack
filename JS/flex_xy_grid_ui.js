import { app } from "../../scripts/app.js";

console.log("Flex XY Grid UI v3: Script is attempting to load...");

app.registerExtension({
    name: "ComfyUI.FlexPack.XYGridUI.v3", // Bumped cache-buster
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        
        if (nodeData.name === "FlexXYGridEngine") { 
            
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            
            nodeType.prototype.onNodeCreated = function () {
                if (onNodeCreated) onNodeCreated.apply(this, arguments);

                try {
                    const moveWidgetToBottom = (name) => {
                        const idx = this.widgets.findIndex(w => w.name === name);
                        if (idx > -1) {
                            const w = this.widgets.splice(idx, 1)[0];
                            this.widgets.push(w);
                        }
                    };

                    const createSectionLabel = (labelName) => {
                        this.addWidget("button", `▬▬▬ ${labelName} ▬▬▬`, null, () => {});
                    };

                    const getBaseWidget = (axisType) => {
                        const map = {
                            "Steps": "steps", "CFG": "cfg", "Sampler": "sampler_name", 
                            "Scheduler": "scheduler", "Checkpoint": "ckpt_name", 
                            "UNET": "unet_name", "CLIP": "clip_name", 
                            "VAE": "vae_name", "LoRA": "base_lora"
                        };
                        return map[axisType] ? this.widgets.find(w => w.name === map[axisType]) : null;
                    };

                    const appendValueToTextBox = (textBoxWidget, valToAppend) => {
                        if (valToAppend !== null && valToAppend !== undefined && valToAppend !== "") {
                            if (textBoxWidget.value.trim() === "") {
                                textBoxWidget.value = String(valToAppend);
                            } else {
                                textBoxWidget.value += `, ${valToAppend}`;
                            }
                            app.graph.setDirtyCanvas(true);
                        }
                    };

                    const addColorPicker = (hexWidgetName, buttonLabel) => {
                        this.addWidget("button", buttonLabel, null, () => {
                            const hexWidget = this.widgets.find(w => w.name === hexWidgetName);
                            if (!hexWidget) return;
                            const input = document.createElement("input");
                            input.type = "color";
                            input.value = /^#[0-9A-F]{6}$/i.test(hexWidget.value) ? hexWidget.value : "#FFFFFF";
                            input.oninput = (e) => {
                                hexWidget.value = e.target.value.toUpperCase();
                                app.graph.setDirtyCanvas(true);
                            };
                            input.click();
                        });
                    };

                    const toggleWidgetVisibility = (widgetName, isVisible) => {
                        const w = this.widgets.find(w => w.name === widgetName);
                        if (w) {
                            w.type = isVisible ? (w.origType || "custom") : "hidden";
                            w.computeSize = isVisible ? undefined : () => [0, -4];
                        }
                    };

                    const updateUI = () => {
                        const modeWidget = this.widgets.find(w => w.name === "model_type");
                        if (!modeWidget) return;
                        
                        const isUNET = modeWidget.value === "UNET";
                        
                        toggleWidgetVisibility("ckpt_name", !isUNET);
                        toggleWidgetVisibility("unet_name", isUNET);
                        toggleWidgetVisibility("clip_name", isUNET);
                        toggleWidgetVisibility("clip_type", isUNET);
                        toggleWidgetVisibility("vae_name", isUNET);
                        
                        // Calculate minimum size needed for visible widgets
                        const minSize = this.computeSize();
                        
                        // Only expand if necessary; never shrink below the user's set/saved size
                        this.size[0] = Math.max(this.size[0], minSize[0]);
                        this.size[1] = Math.max(this.size[1], minSize[1]);
                        
                        app.graph.setDirtyCanvas(true, true);
                    };

                    this.widgets.forEach(w => w.origType = w.type);

                    // 1. BASE SETTINGS
                    createSectionLabel("BASE SETTINGS");
                    ["model_type", "ckpt_name", "unet_name", "clip_name", "clip_type", "vae_name", "base_lora", "lora_strength_model", "lora_strength_clip", "positive_prompt", "negative_prompt", "width", "height", "seed", "control_after_generate", "steps", "cfg", "sampler_name", "scheduler"].forEach(moveWidgetToBottom);

                    const modeWidget = this.widgets.find(w => w.name === "model_type");
                    if (modeWidget) {
                        const origCallback = modeWidget.callback;
                        modeWidget.callback = function () {
                            updateUI();
                            if (origCallback) origCallback.apply(this, arguments);
                        };
                    }

                    // 2. X AXIS
                    createSectionLabel("X AXIS");
                    ["x_axis_type"].forEach(moveWidgetToBottom);
                    
                    this.addWidget("button", "➕ Append Selected Base", "append_x_btn", () => {
                        const xType = this.widgets.find(w => w.name === "x_axis_type").value;
                        const xVals = this.widgets.find(w => w.name === "x_axis_values");
                        const baseWidget = getBaseWidget(xType);
                        if (baseWidget) appendValueToTextBox(xVals, baseWidget.value);
                    });

                    this.addWidget("button", "📑 Add ALL Available", "add_all_x_btn", () => {
                        const xType = this.widgets.find(w => w.name === "x_axis_type").value;
                        const xVals = this.widgets.find(w => w.name === "x_axis_values");
                        const baseWidget = getBaseWidget(xType);
                        if (baseWidget && baseWidget.options && baseWidget.options.values) {
                            const allVals = baseWidget.options.values.filter(v => v !== "None");
                            appendValueToTextBox(xVals, allVals.join(", "));
                        }
                    });
                    ["x_axis_values"].forEach(moveWidgetToBottom);

                    // 3. Y AXIS
                    createSectionLabel("Y AXIS");
                    ["y_axis_type"].forEach(moveWidgetToBottom);
                    
                    this.addWidget("button", "➕ Append Selected Base", "append_y_btn", () => {
                        const yType = this.widgets.find(w => w.name === "y_axis_type").value;
                        const yVals = this.widgets.find(w => w.name === "y_axis_values");
                        const baseWidget = getBaseWidget(yType);
                        if (baseWidget) appendValueToTextBox(yVals, baseWidget.value);
                    });

                    this.addWidget("button", "📑 Add ALL Available", "add_all_y_btn", () => {
                        const yType = this.widgets.find(w => w.name === "y_axis_type").value;
                        const yVals = this.widgets.find(w => w.name === "y_axis_values");
                        const baseWidget = getBaseWidget(yType);
                        if (baseWidget && baseWidget.options && baseWidget.options.values) {
                            const allVals = baseWidget.options.values.filter(v => v !== "None");
                            appendValueToTextBox(yVals, allVals.join(", "));
                        }
                    });
                    ["y_axis_values"].forEach(moveWidgetToBottom);

                    // 4. GRID APPEARANCE
                    createSectionLabel("GRID APPEARANCE");
                    ["padding", "font_size", "grid_scale"].forEach(moveWidgetToBottom);
                    
                    addColorPicker("bg_color_hex", "🎨 Pick Background Color");
                    ["bg_color_hex"].forEach(moveWidgetToBottom);
                    
                    addColorPicker("font_color_hex", "🎨 Pick Font Color");
                    ["font_color_hex"].forEach(moveWidgetToBottom);

                    // 5. Swap Button
                    this.addWidget("button", "🔄 Swap X & Y Axes", "swap_btn", () => {
                        const xType = this.widgets.find(w => w.name === "x_axis_type");
                        const xVals = this.widgets.find(w => w.name === "x_axis_values");
                        const yType = this.widgets.find(w => w.name === "y_axis_type");
                        const yVals = this.widgets.find(w => w.name === "y_axis_values");

                        if (xType && xVals && yType && yVals) {
                            const tempType = xType.value;
                            const tempVals = xVals.value;
                            xType.value = yType.value;
                            xVals.value = yVals.value;
                            yType.value = tempType;
                            yVals.value = tempVals;
                            app.graph.setDirtyCanvas(true);
                        }
                    });

                    setTimeout(updateUI, 50);
                } catch (e) {
                    console.error("Flex XY Grid UI Error mapping widgets:", e);
                }
            };
        }
    }
});
