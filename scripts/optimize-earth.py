"""Repack Earth GLB textures for the web without changing geometry or materials.

Requires Pillow. Run from the repository root; the original asset is preserved.
"""
import io
import json
import struct
from pathlib import Path

from PIL import Image

source = Path('public/earth globe 3d model.glb').read_bytes()
json_size = struct.unpack_from('<I', source, 12)[0]
document = json.loads(source[20:20 + json_size])
binary = source[28 + json_size:]
replacements = {}
for image in document['images']:
    index = image['bufferView']
    view = document['bufferViews'][index]
    start = view.get('byteOffset', 0)
    texture = Image.open(io.BytesIO(binary[start:start + view['byteLength']]))
    original_size = texture.size
    texture.thumbnail((2048, 2048), Image.Resampling.LANCZOS)
    output = io.BytesIO()
    texture.convert('RGB').save(output, format='JPEG', quality=88, optimize=True)
    replacements[index] = output.getvalue()
    image['mimeType'] = 'image/jpeg'
    print(f'Texture {index}: {original_size} -> {texture.size}, {len(output.getvalue())} bytes')

packed = bytearray()
for index, view in enumerate(document['bufferViews']):
    start = view.get('byteOffset', 0)
    content = replacements.get(index, binary[start:start + view['byteLength']])
    packed.extend(b'\x00' * (-len(packed) % 4))
    view['byteOffset'] = len(packed)
    view['byteLength'] = len(content)
    packed.extend(content)
document['buffers'][0]['byteLength'] = len(packed)
packed.extend(b'\x00' * (-len(packed) % 4))
metadata = json.dumps(document, separators=(',', ':')).encode()
metadata += b' ' * (-len(metadata) % 4)
result = (struct.pack('<III', 0x46546C67, 2, 28 + len(metadata) + len(packed))
          + struct.pack('<II', len(metadata), 0x4E4F534A) + metadata
          + struct.pack('<II', len(packed), 0x004E4942) + packed)
Path('public/earth-optimized.glb').write_bytes(result)
print(f'GLB: {len(source)} -> {len(result)} bytes')
