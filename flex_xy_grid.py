import torch
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageColor
import folder_paths
import nodes
import comfy.samplers
import hashlib
import json
import re

class FlexXYGridEngine:
    last_run_hash = None
    cached_images = {}

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                # --- BASE SETTINGS ---
                "model_type": (["Checkpoint", "UNET"], {"default": "Checkpoint"}),
                "ckpt_name": (folder_paths.get_filename_list("checkpoints"), ),
                "unet_name": (folder_paths.get_filename_list("unet"), ),
                "clip_name": (folder_paths.get_filename_list("clip"), ),
                "clip_type": (["stable_diffusion", "stable_cascade", "sd3", "stable_audio", "lcm", "flux", "lumina2"], {"default": "stable_diffusion"}),
                "vae_name": (folder_paths.get_filename_list("vae"), ),
                
                "base_lora": (["None"] + folder_paths.get_filename_list("loras"), ),
                "lora_strength_model": ("FLOAT", {"default": 1.0, "min": -10.0, "max": 10.0, "step": 0.05}),
                "lora_strength_clip": ("FLOAT", {"default": 1.0, "min": -10.0, "max": 10.0, "step": 0.05}),
                
                "positive_prompt": ("STRING", {"multiline": True, "default": "A beautiful photo of a <X> in the <Y>"}),
                "negative_prompt": ("STRING", {"multiline": True, "default": "ugly, bad quality"}),
                "width": ("INT", {"default": 512, "min": 64, "max": 8192, "step": 64}),
                "height": ("INT", {"default": 512, "min": 64, "max": 8192, "step": 64}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "steps": ("INT", {"default": 20, "min": 1, "max": 100}),
                "cfg": ("FLOAT", {"default": 8.0, "min": 0.0, "max": 100.0}),
                "sampler_name": (comfy.samplers.KSampler.SAMPLERS, ),
                "scheduler": (comfy.samplers.KSampler.SCHEDULERS, ),
                
                # --- X AXIS ---
                "x_axis_type": (["None", "Prompt S/R", "Steps", "CFG", "Sampler", "Scheduler", "Checkpoint", "UNET", "CLIP", "VAE", "LoRA", "LoRA Strength"],),
                "x_axis_values": ("STRING", {"multiline": True, "default": "cat, dog"}),
                
                # --- Y AXIS ---
                "y_axis_type": (["None", "Prompt S/R", "Steps", "CFG", "Sampler", "Scheduler", "Checkpoint", "UNET", "CLIP", "VAE", "LoRA", "LoRA Strength"],),
                "y_axis_values": ("STRING", {"multiline": True, "default": "morning, night"}),
                
                # --- GRID APPEARANCE ---
                "padding": ("INT", {"default": 20, "min": 0, "max": 500}),
                "font_size": ("INT", {"default": 40, "min": 8, "max": 128}),
                "grid_scale": ("FLOAT", {"default": 1.0, "min": 0.1, "max": 5.0, "step": 0.1}),
                "bg_color_hex": ("STRING", {"default": "#FFFFFF"}),
                "font_color_hex": ("STRING", {"default": "#000000"}),
            }
        }

    RETURN_TYPES = ("IMAGE", "IMAGE")
    RETURN_NAMES = ("Grid Image", "Individual Images")
    FUNCTION = "generate_grid"
    CATEGORY = "Flex Pack"

    def parse_values(self, val_str, axis_type):
            if axis_type == "None": return ["None"]
            
            # Split by comma and clean whitespace
            raw_vals = [v.strip() for v in val_str.split(",") if v.strip()]
            parsed = []
            
            for val in raw_vals:
                # Check for range pattern: start-end (+increment) or start-end (increment)
                # Example: 1-5 (+2) or 1.0-2.0 (0.5)
                range_match = re.match(r"([\d\.]+)-([\d\.]+)(?:\s*[\(\+]+([\d\.]+)[\)]+)?", val)
                
                if range_match and axis_type in ["Steps", "CFG", "LoRA Strength"]:
                    start = float(range_match.group(1))
                    end = float(range_match.group(2))
                    # Default increment to 1.0 if not specified
                    step = float(range_match.group(3)) if range_match.group(3) else 1.0
                    
                    curr = start
                    # Use a small epsilon for float comparison to avoid precision issues
                    while curr <= end + (step * 0.01):
                        if axis_type == "Steps":
                            parsed.append(int(curr))
                        else:
                            parsed.append(round(curr, 4))
                        curr += step
                else:
                    parsed.append(val)
                    
            # Final type casting
            if axis_type == "Steps": return [int(v) for v in parsed if str(v).replace('.','').isdigit()]
            if axis_type in ["CFG", "LoRA Strength"]: 
                return [float(v) for v in parsed if str(v).replace('.','').replace('-','').isdigit()]
            
            return parsed

    def generate_grid(self, model_type, ckpt_name, unet_name, clip_name, clip_type, vae_name, base_lora, lora_strength_model, lora_strength_clip, positive_prompt, negative_prompt, width, height, seed, steps, cfg, sampler_name, scheduler, x_axis_type, x_axis_values, y_axis_type, y_axis_values, padding, font_size, grid_scale, bg_color_hex, font_color_hex):
        
        params_to_hash = {
            "mtype": model_type, "ckpt": ckpt_name, "unet": unet_name, "clip": clip_name, "ctype": clip_type, "vae": vae_name, 
            "lora": base_lora, "lsm": lora_strength_model, "lsc": lora_strength_clip,
            "pos": positive_prompt, "neg": negative_prompt, "w": width, "h": height, "seed": seed,
            "steps": steps, "cfg": cfg, "samp": sampler_name, "sched": scheduler,
            "xt": x_axis_type, "xv": x_axis_values, "yt": y_axis_type, "yv": y_axis_values
        }
        param_str = json.dumps(params_to_hash, sort_keys=True)
        current_hash = hashlib.md5(param_str.encode()).hexdigest()

        x_vals = self.parse_values(x_axis_values, x_axis_type)
        y_vals = self.parse_values(y_axis_values, y_axis_type)

        grid_images = {}

        if FlexXYGridEngine.last_run_hash == current_hash and FlexXYGridEngine.cached_images:
            grid_images = FlexXYGridEngine.cached_images
        else:
            loader = nodes.CheckpointLoaderSimple()
            unet_loader = nodes.UNETLoader()
            clip_loader = nodes.CLIPLoader()
            vae_loader = nodes.VAELoader()
            lora_loader = nodes.LoraLoader()
            clip_encode = nodes.CLIPTextEncode()
            ksampler = nodes.KSampler()
            vae_decode = nodes.VAEDecode()

            current_ckpt = ckpt_name
            current_unet = unet_name
            current_clip = clip_name
            current_vae = vae_name
            
            if model_type == "Checkpoint":
                model, clip, vae = loader.load_checkpoint(ckpt_name)
            else:
                model = unet_loader.load_unet(unet_name, "default")[0]
                clip = clip_loader.load_clip(clip_name, clip_type)[0]
                vae = vae_loader.load_vae(vae_name)[0]
            
            if base_lora != "None":
                model, clip = lora_loader.load_lora(model, clip, base_lora, lora_strength_model, lora_strength_clip)

            for y_idx, y_val in enumerate(y_vals):
                for x_idx, x_val in enumerate(x_vals):
                    
                    curr_steps = x_val if x_axis_type == "Steps" else (y_val if y_axis_type == "Steps" else steps)
                    curr_cfg = x_val if x_axis_type == "CFG" else (y_val if y_axis_type == "CFG" else cfg)
                    curr_sampler = x_val if x_axis_type == "Sampler" else (y_val if y_axis_type == "Sampler" else sampler_name)
                    curr_sched = x_val if x_axis_type == "Scheduler" else (y_val if y_axis_type == "Scheduler" else scheduler)
                    curr_ckpt = x_val if x_axis_type == "Checkpoint" else (y_val if y_axis_type == "Checkpoint" else ckpt_name)
                    curr_unet = x_val if x_axis_type == "UNET" else (y_val if y_axis_type == "UNET" else unet_name)
                    curr_clip_val = x_val if x_axis_type == "CLIP" else (y_val if y_axis_type == "CLIP" else clip_name)
                    curr_vae_val = x_val if x_axis_type == "VAE" else (y_val if y_axis_type == "VAE" else vae_name)
                    curr_lora = x_val if x_axis_type == "LoRA" else (y_val if y_axis_type == "LoRA" else "None")
                    curr_lora_str = x_val if x_axis_type == "LoRA Strength" else (y_val if y_axis_type == "LoRA Strength" else lora_strength_model)
                    
                    curr_pos, curr_neg = positive_prompt, negative_prompt
                    
                    if x_axis_type == "Prompt S/R":
                        curr_pos = re.sub(r'<x>', str(x_val), curr_pos, flags=re.IGNORECASE)
                        curr_neg = re.sub(r'<x>', str(x_val), curr_neg, flags=re.IGNORECASE)
                    if y_axis_type == "Prompt S/R":
                        curr_pos = re.sub(r'<y>', str(y_val), curr_pos, flags=re.IGNORECASE)
                        curr_neg = re.sub(r'<y>', str(y_val), curr_neg, flags=re.IGNORECASE)

                    if model_type == "Checkpoint":
                        if curr_ckpt != current_ckpt:
                            model, clip, vae = loader.load_checkpoint(curr_ckpt)
                            current_ckpt = curr_ckpt
                    else:
                        if curr_unet != current_unet:
                            model = unet_loader.load_unet(curr_unet, "default")[0]
                            current_unet = curr_unet
                        if curr_clip_val != current_clip:
                            clip = clip_loader.load_clip(curr_clip_val, clip_type)[0]
                            current_clip = curr_clip_val
                        if curr_vae_val != current_vae:
                            vae = vae_loader.load_vae(curr_vae_val)[0]
                            current_vae = curr_vae_val
                    
                    loop_model, loop_clip = model, clip
                    
                    active_lora = curr_lora if curr_lora != "None" else base_lora
                    if active_lora != "None":
                        loop_model, loop_clip = lora_loader.load_lora(loop_model, loop_clip, active_lora, curr_lora_str, curr_lora_str)

                    cond = clip_encode.encode(loop_clip, curr_pos)[0]
                    uncond = clip_encode.encode(loop_clip, curr_neg)[0]
                    latent = {"samples": torch.zeros([1, 4, height // 8, width // 8])}

                    latent_out = ksampler.sample(loop_model, seed, curr_steps, curr_cfg, curr_sampler, curr_sched, cond, uncond, latent, 1.0)[0]

                    img_tensor = vae_decode.decode(vae, latent_out)[0]
                    i = 255. * img_tensor[0].cpu().numpy()
                    img_pil = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))
                    
                    grid_images[(x_idx, y_idx)] = img_pil

            FlexXYGridEngine.last_run_hash = current_hash
            FlexXYGridEngine.cached_images = grid_images

        final_grid_tensor = self.assemble_pil_grid(grid_images, x_vals, y_vals, padding, font_size, bg_color_hex, font_color_hex, grid_scale)
        
        individual_tensors = []
        for y in range(len(y_vals)):
            for x in range(len(x_vals)):
                img_pil = grid_images[(x,y)]
                tensor = torch.from_numpy(np.array(img_pil).astype(np.float32) / 255.0).unsqueeze(0)
                individual_tensors.append(tensor)
        
        batch_tensor = torch.cat(individual_tensors, dim=0)

        return (final_grid_tensor, batch_tensor)

    def assemble_pil_grid(self, grid_images, x_vals, y_vals, padding, font_size, bg_color_hex, font_color_hex, grid_scale):
        try:
            bg_color = ImageColor.getrgb(bg_color_hex)
            font_color = ImageColor.getrgb(font_color_hex)
        except:
            bg_color, font_color = (255, 255, 255), (0, 0, 0)
            
        sample_img = grid_images[(0, 0)]
        img_w, img_h = sample_img.size

        has_ttf = True
        try:
            base_font_path = "arial.ttf"
            ImageFont.truetype(base_font_path, font_size)
        except:
            has_ttf = False

        draw_temp = ImageDraw.Draw(Image.new('RGB', (1, 1)))
        
        def get_fit_font(text, max_w, start_size):
            if not has_ttf:
                return ImageFont.load_default(), draw_temp.textbbox((0, 0), text, font=ImageFont.load_default())
            sz = start_size
            f = ImageFont.truetype(base_font_path, sz)
            bx = draw_temp.textbbox((0, 0), text, font=f)
            while (bx[2] - bx[0] > max_w) and sz > 10:
                sz -= 1
                f = ImageFont.truetype(base_font_path, sz)
                bx = draw_temp.textbbox((0, 0), text, font=f)
            return f, bx

        # Enforce a strict max width for the Y column (300px or the image width, whichever is smaller)
        max_allowed_y_width = min(img_w, 300)
        
        max_y_width = 0
        if str(y_vals[0]) != "None":
            for y in y_vals:
                f = ImageFont.truetype(base_font_path, font_size) if has_ttf else ImageFont.load_default()
                bbox = draw_temp.textbbox((0, 0), str(y), font=f)
                max_y_width = max(max_y_width, bbox[2] - bbox[0])
        
        capped_y_width = min(max_y_width, max_allowed_y_width)

        left_margin = int(capped_y_width) + (padding * 2) if str(y_vals[0]) != "None" else padding
        top_margin = font_size + (padding * 2) if str(x_vals[0]) != "None" else padding
        right_margin = padding
        bottom_margin = padding

        total_x, total_y = len(x_vals), len(y_vals)
        
        grid_w = left_margin + (img_w * total_x) + (padding * (total_x - 1)) + right_margin
        grid_h = top_margin + (img_h * total_y) + (padding * (total_y - 1)) + bottom_margin

        grid_img = Image.new('RGB', (grid_w, grid_h), color=bg_color)
        draw = ImageDraw.Draw(grid_img)

        for y in range(total_y):
            paste_y = top_margin + (y * (img_h + padding))

            if y < len(y_vals) and str(y_vals[0]) != "None":
                text = str(y_vals[y])
                f, bbox = get_fit_font(text, capped_y_width, font_size)
                text_w = bbox[2] - bbox[0]
                text_h = bbox[3] - bbox[1]
                t_y = paste_y + (img_h / 2) - (text_h / 2)
                t_x = padding + (capped_y_width / 2) - (text_w / 2)
                draw.text((t_x, t_y), text, fill=font_color, font=f)

            curr_x_offset = left_margin
            for x in range(total_x):
                grid_img.paste(grid_images[(x, y)], (curr_x_offset, paste_y))

                if y == 0 and str(x_vals[0]) != "None":
                    text = str(x_vals[x])
                    f, bbox = get_fit_font(text, img_w, font_size)
                    text_w = bbox[2] - bbox[0]
                    text_h = bbox[3] - bbox[1]
                    t_x = curr_x_offset + (img_w / 2) - (text_w / 2)
                    t_y = padding + (font_size / 2) - (text_h / 2)
                    draw.text((t_x, t_y), text, fill=font_color, font=f)

                curr_x_offset += img_w + padding

        if grid_scale != 1.0:
            new_w = int(grid_w * grid_scale)
            new_h = int(grid_h * grid_scale)
            grid_img = grid_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        return torch.from_numpy(np.array(grid_img).astype(np.float32) / 255.0).unsqueeze(0)
    
NODE_CLASS_MAPPINGS = {
    "FlexXYGridEngine": FlexXYGridEngine
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "FlexXYGridEngine": "Flex XY Grid Engine"
}