import os
import shutil
import folder_paths
from server import PromptServer
from aiohttp import web
from nodes import PreviewImage

class FlexImageCompare(PreviewImage):
    def __init__(self):
        super().__init__()

    @classmethod
    def INPUT_TYPES(s):
        return {
            "required": {
                "images": ("IMAGE",),
                "filename_prefix": ("STRING", {"default": "compare/comparison"}),
            },
            "hidden": {"prompt": "PROMPT", "extra_pnginfo": "EXTRA_PNGINFO"},
        }

    RETURN_TYPES = ()
    FUNCTION = "compare_images_preview"
    OUTPUT_NODE = True
    CATEGORY = "image"

    def compare_images_preview(self, images, filename_prefix="compare/comparison", prompt=None, extra_pnginfo=None):
        saved = self.save_images(images, "flex_temp", prompt, extra_pnginfo)
        return { "ui": { "bypassed_images": saved["ui"]["images"], "prefix": [filename_prefix] } }

@PromptServer.instance.routes.post("/flex_compare/save")
async def flex_compare_save(request):
    post_data = await request.json()
    filename = post_data.get("filename")
    prefix = post_data.get("prefix", "compare/comparison")

    temp_dir = folder_paths.get_temp_directory()
    src_path = os.path.join(temp_dir, filename)

    if not os.path.exists(src_path):
        return web.json_response({"status": "error", "message": "File not found in temp"}, status=404)

    full_output_folder, file_prefix, counter, subfolder, _ = folder_paths.get_save_image_path(prefix, folder_paths.get_output_directory(), 1, 1)
    
    # FIXED: Added the required trailing underscore so ComfyUI's scanner recognizes the file
    new_filename = f"{file_prefix}_{counter:05d}_.png"
    dst_path = os.path.join(full_output_folder, new_filename)

    os.makedirs(full_output_folder, exist_ok=True)
    shutil.copy2(src_path, dst_path)

    return web.json_response({"status": "success", "file": new_filename})

NODE_CLASS_MAPPINGS = {"Flex Image Compare": FlexImageCompare}
NODE_DISPLAY_NAME_MAPPINGS = {"Flex Image Compare": "Flex Image Compare"}