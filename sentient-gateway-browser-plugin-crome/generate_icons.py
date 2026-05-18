import struct, zlib, os

def create_png(width, height, r, g, b):
    def chunk(ctype, data):
        c = ctype + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(data)) + c + crc
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))
    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            raw += struct.pack('BBB', r, g, b)
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    return sig + ihdr + idat + iend

os.makedirs('icons', exist_ok=True)
sizes = [(16, 'icon16'), (48, 'icon48'), (128, 'icon128')]
for size, name in sizes:
    data = create_png(size, size, 37, 99, 235)
    with open(f'icons/{name}.png', 'wb') as f:
        f.write(data)
    print(f'Created {name}.png ({size}x{size})')
