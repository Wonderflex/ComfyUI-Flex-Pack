import os
import json
import comfy.sd
import comfy.utils
import folder_paths
from server import PromptServer
from aiohttp import web

# Renamed to the new, specific config file
CONFIG_FILE = os.path.join(os.path.dirname(os.path.realpath(__file__)), "flex_lora_slider_config.json")

def load_configs():
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            try:
                data = json.load(f)
                # Ensure the base structure exists
                if "loras" not in data: data["loras"] = {}
                if "presets" not in data: data["presets"] = {}
                return data
            except Exception:
                pass
    return {"loras": {}, "presets": {}}

def save_configs(data):
    with open(CONFIG_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

@PromptServer.instance.routes.get("/flex_pack/loras")
async def get_loras(request):
    loras = folder_paths.get_filename_list("loras")
    return web.json_response(loras)

@PromptServer.instance.routes.get("/flex_pack/configs")
async def get_configs(request):
    return web.json_response(load_configs())

# Endpoint for saving individual LoRA settings
@PromptServer.instance.routes.post("/flex_pack/configs/lora")
async def save_lora_config(request):
    new_config = await request.json()
    lora_name = new_config.get("lora")
    
    if not lora_name or lora_name == "None":
        return web.json_response({"status": "ignored"})

    data = load_configs()
    data["loras"][lora_name] = new_config
    save_configs(data)

    return web.json_response({"status": "success"})

# Endpoint for saving full stack presets
@PromptServer.instance.routes.post("/flex_pack/configs/preset")
async def save_preset_config(request):
    payload = await request.json()
    preset_name = payload.get("name")
    preset_data = payload.get("data")
    
    if not preset_name or not preset_data:
        return web.json_response({"status": "error", "message": "Invalid payload"})

    data = load_configs()
    data["presets"][preset_name] = preset_data
    save_configs(data)
    
    return web.json_response({"status": "success"})

class FlexLoraSlider:
    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
            },
            "hidden": {
                "prompt": "PROMPT", 
                "unique_id": "UNIQUE_ID",
                "extra_pnginfo": "EXTRA_PNGINFO"
            },
        }

    RETURN_TYPES = ("MODEL", "CLIP", "STRING")
    RETURN_NAMES = ("MODEL", "CLIP", "KEYWORDS")
    FUNCTION = "apply_loras"
    CATEGORY = "COMFYUI-FLEX-PACK"

    def apply_loras(self, model, clip, prompt=None, unique_id=None, **kwargs):
        if prompt is None or unique_id is None:
            return (model, clip, "")

        node_inputs = prompt[unique_id].get("inputs", {})

        lora_configs = {}
        lora_values = {}
        active_keywords = []

        for key, value in node_inputs.items():
            if key.startswith("config_"):
                lora_id = key.split("_")[1]
                try:
                    lora_configs[lora_id] = json.loads(value)
                except Exception:
                    pass
            elif key.startswith("val_"):
                lora_id = key.split("_")[1]
                lora_values[lora_id] = value

        for lora_id, config in lora_configs.items():
            lora_name = config.get("lora")
            is_active = config.get("active", True)
            slider_val = float(lora_values.get(lora_id, 0))

            if not is_active or not lora_name or lora_name == "None":
                continue

            min_val = float(config.get("min_val", -2.0))
            max_val = float(config.get("max_val", 2.0))

            if slider_val > 0:
                strength = (slider_val / 100.0) * max_val
            elif slider_val < 0:
                strength = (abs(slider_val) / 100.0) * min_val
            else:
                strength = 0.0

            if strength == 0:
                continue

            lora_path = folder_paths.get_full_path("loras", lora_name)
            if lora_path is None:
                print(f"Flex Pack: LoRA '{lora_name}' not found.")
                continue
                
            lora = comfy.utils.load_torch_file(lora_path, safe_load=True)
            model, clip = comfy.sd.load_lora_for_models(model, clip, lora, strength, strength)
            
            keywords = config.get("keywords", "").strip()
            if keywords:
                active_keywords.append(keywords)

        final_keywords = ", ".join(active_keywords)
        return (model, clip, final_keywords)

NODE_CLASS_MAPPINGS = {
    "FlexLoraSlider": FlexLoraSlider
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "FlexLoraSlider": "Flex LoRA Slider"
}