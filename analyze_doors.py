from PIL import Image
img = Image.open(r'c:\Users\calca\Desktop\Carlos\Developer\Honeymoon-rush\assets\hub_bg.png')
px = img.load()
w,h = img.size

def is_purple(r,g,b): return 35<r<90 and 15<g<45 and b>65
def is_yellow(r,g,b): return r>180 and g>150
def is_green(r,g,b): return g>80 and r<60

# DOOR 1 - Purple: horizontal extent at y=80%
y80 = int(h*0.80)
d1_left = d1_right = None
for x in range(w):
    r,g,b = px[x,y80][:3]
    if is_purple(r,g,b):
        if d1_left is None: d1_left = x
        d1_right = x

# DOOR 1 vertical bounds
x_d1 = int(w*0.35)
d1_top = d1_bot = None
for yy in range(h):
    r,g,b = px[x_d1,yy][:3]
    if is_purple(r,g,b):
        if d1_top is None: d1_top = yy
        d1_bot = yy

print(f'DOOR 1 (Purple):')
print(f'  X: {d1_left}-{d1_right} ({d1_left/w*100:.1f}%-{d1_right/w*100:.1f}%)')
print(f'  Y: {d1_top}-{d1_bot} ({d1_top/h*100:.1f}%-{d1_bot/h*100:.1f}%)')
cx1 = (d1_left+d1_right)/2/w*100
cy1 = (d1_top+d1_bot)/2/h*100
print(f'  Center: ({cx1:.1f}%, {cy1:.1f}%)')
dw1 = (d1_right-d1_left)/w*100
dh1 = (d1_bot-d1_top)/h*100
print(f'  Size: {dw1:.1f}% x {dh1:.1f}%')

# DOOR 2 - Yellow windows at y=80%
yellows = []
for x in range(w):
    r,g,b = px[x,y80][:3]
    if is_yellow(r,g,b):
        yellows.append(x)

# Door 2 vertical bounds using yellow detection
x_d2 = int(w*0.45)
d2_top = d2_bot = None
for yy in range(h):
    r,g,b = px[x_d2,yy][:3]
    if is_yellow(r,g,b):
        if d2_top is None: d2_top = yy
        d2_bot = yy

print(f'\nDOOR 2 (Yellow/Center):')
if yellows:
    # Find two clusters of yellow pixels
    clusters = []
    start = yellows[0]
    prev = yellows[0]
    for xv in yellows[1:]:
        if xv - prev > 5:
            clusters.append((start, prev))
            start = xv
        prev = xv
    clusters.append((start, prev))
    print(f'  Yellow clusters: {clusters}')
    for i, (s,e) in enumerate(clusters):
        print(f'    Cluster {i}: x={s}-{e} ({s/w*100:.1f}%-{e/w*100:.1f}%)')
    # Door spans from first cluster start to last cluster end
    door2_left = clusters[0][0]
    door2_right = clusters[-1][1]
    cx2 = (door2_left+door2_right)/2/w*100
    print(f'  Door X range: {door2_left/w*100:.1f}%-{door2_right/w*100:.1f}%')
else:
    door2_left = int(w*0.42)
    door2_right = int(w*0.58)
    cx2 = 50.0

if d2_top and d2_bot:
    print(f'  Yellow Y: {d2_top}-{d2_bot} ({d2_top/h*100:.1f}%-{d2_bot/h*100:.1f}%)')
    cy2 = (d2_top+d2_bot)/2/h*100
else:
    cy2 = 80.0
    d2_top = int(h*0.72)
    d2_bot = int(h*0.90)

# The actual door area is bigger than just the yellow lights
# Expand to include the wall between lights
door2_top = d2_top - int(h*0.05)
door2_bot = d2_bot + int(h*0.02)
print(f'  Center: ({cx2:.1f}%, {cy2:.1f}%)')
dw2 = (door2_right-door2_left)/w*100
dh2 = (door2_bot-door2_top)/h*100
print(f'  Size: {dw2:.1f}% x {dh2:.1f}%')

# DOOR 3 - Green: horizontal extent at y=85%
y85 = int(h*0.85)
d3_left = d3_right = None
for x in range(w):
    r,g,b = px[x,y85][:3]
    if is_green(r,g,b):
        if d3_left is None: d3_left = x
        d3_right = x

x_d3 = int(w*0.82)
d3_top = d3_bot = None
for yy in range(h):
    r,g,b = px[x_d3,yy][:3]
    if is_green(r,g,b):
        if d3_top is None: d3_top = yy
        d3_bot = yy

print(f'\nDOOR 3 (Green):')
print(f'  X: {d3_left}-{d3_right} ({d3_left/w*100:.1f}%-{d3_right/w*100:.1f}%)')
print(f'  Y: {d3_top}-{d3_bot} ({d3_top/h*100:.1f}%-{d3_bot/h*100:.1f}%)')
cx3 = (d3_left+d3_right)/2/w*100
cy3 = (d3_top+d3_bot)/2/h*100
print(f'  Center: ({cx3:.1f}%, {cy3:.1f}%)')
dw3 = (d3_right-d3_left)/w*100
dh3 = (d3_bot-d3_top)/h*100
print(f'  Size: {dw3:.1f}% x {dh3:.1f}%')

print('\n=== SUMMARY (for CSS positioning) ===')
print('Image is displayed with object-fit:cover, so % positions are relative to image bounds')
print(f'Door 1 (Broadway/Purple): center=({cx1:.1f}%, {cy1:.1f}%), size=({dw1:.1f}% x {dh1:.1f}%)')
print(f'Door 2 (Taxi/Yellow):    center=({cx2:.1f}%, {cy2:.1f}%), size=({dw2:.1f}% x {dh2:.1f}%)')
print(f'Door 3 (Park/Green):     center=({cx3:.1f}%, {cy3:.1f}%), size=({dw3:.1f}% x {dh3:.1f}%)')

# For CSS with bottom/left positioning (origin at bottom-left):
# bottom = 100% - (center_y% + height%/2)
# left = center_x%
for name, cx, cy, dw_, dh_ in [
    ('broadway', cx1, cy1, dw1, dh1),
    ('taxi', cx2, cy2, dw2, dh2),
    ('park', cx3, cy3, dw3, dh3),
]:
    top_pct = cy - dh_/2
    bottom_pct = 100.0 - (cy + dh_/2)
    print(f'\n{name}:')
    print(f'  CSS left: {cx:.1f}%')
    print(f'  CSS top: {top_pct:.1f}%')
    print(f'  CSS bottom: {bottom_pct:.1f}%')
    print(f'  CSS width: {dw_:.1f}%')
    print(f'  CSS height: {dh_:.1f}%')
