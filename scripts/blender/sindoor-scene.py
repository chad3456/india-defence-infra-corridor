"""
The Operation Sindoor walkthrough, rendered as ink on paper.

    npm run sindoor:render     (python3 scripts/blender/sindoor-scene.py)

Builds a 3-D scene of the country shapes around the Line of Control from
Natural Earth, marks the sites the Sindoor book names, and renders a sequence
of camera positions as Freestyle line art. The frames become the scroll
walkthrough at /sindoor-walkthrough.

── What this is allowed to draw ─────────────────────────────────────────────

Geography, and where a claim is located. Nothing else.

There are no explosions, no impact markers, no arcs showing a missile's flight
and no wreckage. That is not a style decision. What was hit, what was destroyed
and what each side lost are precisely the questions the Indian and Pakistani
accounts answer differently, and a rendered fireball over a named town would
settle one of them in the reader's mind with a picture rather than with
evidence. A drawing is the most persuasive way there is to assert something
without sourcing it.

So a site is a pin with a label, and the label says who named it and on what
page. The camera moves; the claims stay claims.

── Why Freestyle, and why the lines wobble ──────────────────────────────────

The brief asked for something hand-drawn, and there is a reason beyond taste
to want it here. A photoreal render of a border region reads as a photograph —
as evidence about the world. An ink drawing reads as what it is: a diagram
somebody made, from data, with choices in it. For a subject where every
photograph is contested, the honest register is the one that does not pretend
to be a window.

Freestyle draws the outlines; a Perlin modifier gives them the unsteadiness of
a pen. The fills are flat. Nothing is lit realistically because nothing here is
a photograph of anything.

── Running it ───────────────────────────────────────────────────────────────

bpy 5.x as a Python module, Cycles on CPU. EEVEE needs libEGL, which a
headless container does not have, so Cycles is not a preference here but the
only engine available. Renders are committed, not rebuilt on every push: they
change only when the geography or the sourced sites change.
"""
import json
import math
import os
import sys

import bpy
import bmesh
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
INPUT = os.path.join(HERE, "scene-input.json")
OUT_DIR = os.path.join(ROOT, "public", "sindoor")

# Paper, ink, and the two tones the story register already uses.
PAPER = (0.972, 0.967, 0.953, 1.0)
INK = (0.055, 0.055, 0.075)
# The first render gave all three countries the same pale grey, which looked
# deliberate and told the reader nothing: the whole frame was one landmass with
# pins on it. These are far enough apart to separate at a glance and close
# enough together that neither country is coloured as the villain.
LAND_IN = (0.882, 0.855, 0.776, 1.0)      # India, warm
LAND_PK = (0.800, 0.824, 0.831, 1.0)      # Pakistan, cool
LAND_OTHER = (0.930, 0.926, 0.914, 1.0)   # everyone else, quieter still
HOT = (0.816, 0.106, 0.318, 1.0)          # --s-hot
MID = (0.839, 0.588, 0.078, 1.0)          # --s-mid

# The window on the world. Everything outside it is clipped away, because a
# whole-subcontinent view puts the nine sites inside four pixels of each other.
LON0, LON1 = 66.0, 80.0
LAT0, LAT1 = 23.0, 38.0
SCALE = 1.0


def project(lon, lat):
    """Equirectangular, centred on the window, with latitude corrected.

    Not a map projection anybody should measure from — it is a stage for a
    camera. Longitude is squeezed by cos(mean latitude) so the shapes are not
    absurdly wide at 30 degrees north.
    """
    mid = math.radians((LAT0 + LAT1) / 2.0)
    x = (lon - (LON0 + LON1) / 2.0) * math.cos(mid) * SCALE
    y = (lat - (LAT0 + LAT1) / 2.0) * SCALE
    return x, y


def flat_material(name, rgba, emit=True):
    """A flat fill.

    Emission rather than diffuse: there is no light in this scene and there
    should not be, because a lit surface implies a sun, a time of day and a
    photograph. A flat colour implies a diagram.
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    if emit:
        sh = nt.nodes.new("ShaderNodeEmission")
        sh.inputs["Color"].default_value = rgba
        sh.inputs["Strength"].default_value = 1.0
    else:
        sh = nt.nodes.new("ShaderNodeBsdfDiffuse")
        sh.inputs["Color"].default_value = rgba
    nt.links.new(sh.outputs[0], out.inputs["Surface"])
    return m


def rings_of(geom):
    """Every outer ring of a Polygon or MultiPolygon, in lon/lat."""
    t = geom.get("type")
    if t == "Polygon":
        return [geom["coordinates"][0]]
    if t == "MultiPolygon":
        return [poly[0] for poly in geom["coordinates"]]
    return []


def clip_ring(ring):
    """Drop rings entirely outside the window; keep the rest whole.

    Deliberately not a real polygon clip. A partial clip would cut a country
    open and Freestyle would draw the cut as though it were a coastline — an
    invented border, in ink, on a page about disputed borders.
    """
    inside = [
        (lon, lat) for lon, lat in ring
        if LON0 - 6 <= lon <= LON1 + 6 and LAT0 - 6 <= lat <= LAT1 + 6
    ]
    return ring if len(inside) >= 3 else None


def country_mesh(name, geom, rgba, z=0.0, thickness=0.06):
    """One country as a set of extruded plates."""
    made = []
    for i, ring in enumerate(rings_of(geom)):
        kept = clip_ring(ring)
        if kept is None or len(kept) < 3:
            continue
        me = bpy.data.meshes.new(f"{name}-{i}")
        bm = bmesh.new()
        verts = [bm.verts.new((*project(lon, lat), z)) for lon, lat in kept[:-1]]
        if len(verts) < 3:
            bm.free()
            continue
        try:
            face = bm.faces.new(verts)
        except ValueError:
            bm.free()
            continue
        bmesh.ops.extrude_face_region(bm, geom=[face])
        bmesh.ops.translate(
            bm, vec=Vector((0, 0, thickness)),
            verts=[v for v in bm.verts if v.is_valid and len(v.link_faces) > 1],
        )
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(f"{name}-{i}", me)
        ob.data.materials.append(rgba)
        bpy.context.collection.objects.link(ob)
        made.append(ob)
    return made


def pin(x, y, colour, height=0.55, head=0.075):
    """A marker: a stalk and a head. Not an impact, not a blast — a pin."""
    bpy.ops.mesh.primitive_cylinder_add(radius=0.012, depth=height, location=(x, y, height / 2 + 0.06))
    stalk = bpy.context.active_object
    stalk.data.materials.append(colour)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=head, segments=14, ring_count=8,
                                         location=(x, y, height + 0.06))
    ball = bpy.context.active_object
    ball.data.materials.append(colour)
    return stalk, ball


def setup_render(width, height, samples):
    s = bpy.context.scene
    s.render.engine = "CYCLES"
    s.cycles.device = "CPU"
    s.cycles.samples = samples
    # Denoising is not for looks here, it is for file size. Flat colour with
    # Cycles noise in it does not compress: the first pass wrote 800 KB a frame
    # for what is, visually, four flat tones and some ink. Denoised, the same
    # frame is a fraction of that, because PNG can finally find the flats.
    s.cycles.use_denoising = True
    s.render.resolution_x = width
    s.render.resolution_y = height
    s.render.resolution_percentage = 100
    s.render.film_transparent = False
    # WebP, not PNG.
    #
    # These frames are four flat tones and some ink, and PNG was writing 790 KB
    # for each of them — thirteen megabytes for the sequence, into a repository
    # whose entire committed dataset is smaller than that. WebP at quality 92
    # is visually identical on flat art and roughly a tenth of the size.
    s.render.image_settings.file_format = "WEBP"
    s.render.image_settings.color_mode = "RGB"
    s.render.image_settings.quality = 92

    # Standard, not AgX.
    #
    # Blender 5 defaults its view transform to AgX, which is a filmic curve
    # built for photographs: it rolls off highlights and desaturates. Applied
    # to flat emission it turned a warm cream and a cool grey into the same
    # grey, and the first two renders showed India and Pakistan as one
    # undifferentiated landmass with pins on it. The colours were correct in
    # the file the whole time — the camera was lying about them.
    #
    # It also matters for file size. A filmic curve turns flat fills into
    # gradients, and PNG cannot compress a gradient the way it compresses a
    # flat.
    s.view_settings.view_transform = "Standard"
    s.view_settings.look = "None"

    world = bpy.data.worlds.new("paper")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = PAPER
        bg.inputs["Strength"].default_value = 1.0
    s.world = world

    # Freestyle: the ink.
    s.render.use_freestyle = True
    vl = s.view_layers[0]
    vl.use_freestyle = True
    fs = vl.freestyle_settings
    for existing in list(fs.linesets):
        fs.linesets.remove(existing)
    lineset = fs.linesets.new("ink")
    style = bpy.data.linestyles.new("ink")
    lineset.linestyle = style
    style.color = INK
    style.thickness = 2.6
    # The unsteadiness of a pen. Without it the lines are CAD, which is a
    # different and much more authoritative-looking claim than this page makes.
    wob = style.geometry_modifiers.new(name="hand", type="PERLIN_NOISE_1D")
    wob.amplitude = 2.2
    wob.frequency = 9.0
    wob.octaves = 3
    nib = style.thickness_modifiers.new(name="nib", type="CALLIGRAPHY")
    nib.orientation = 0.5
    nib.thickness_min = 1.1
    nib.thickness_max = 3.4
    return s


def look_at(cam, target):
    d = Vector(target) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


def main():
    if not os.path.exists(INPUT):
        sys.exit(f"No {INPUT}. Run `npm run sindoor:geo` first.")
    data = json.load(open(INPUT))
    sites = data.get("sites", [])

    bpy.ops.wm.read_factory_settings(use_empty=True)
    setup_render(1500, 940, int(os.environ.get("SINDOOR_SAMPLES", "12")))

    m_in = flat_material("india", LAND_IN)
    m_pk = flat_material("pakistan", LAND_PK)
    m_other = flat_material("other", LAND_OTHER)
    m_hot = flat_material("hot", HOT)
    m_mid = flat_material("mid", MID)

    for f in data["countries"]["features"]:
        iso = f["id"]
        mat = m_in if iso == "356" else m_pk if iso == "586" else m_other
        zz = 0.02 if iso in ("356", "586") else 0.0
        country_mesh(f["properties"]["name"], f["geometry"], mat, z=zz,
                     thickness=0.09 if iso in ("356", "586") else 0.05)

    placed = []
    for s in sites:
        pos = s.get("position")
        if not pos:
            continue
        x, y = project(pos["lon"], pos["lat"])
        if not (LON0 - 1 <= pos["lon"] <= LON1 + 1 and LAT0 - 1 <= pos["lat"] <= LAT1 + 1):
            continue
        pin(x, y, m_hot if s.get("kind") == "camp" else m_mid)
        placed.append((s, x, y))
    print(f"placed {len(placed)} of {len(sites)} sites in frame")

    cam_d = bpy.data.cameras.new("cam")
    cam_d.lens = 46
    cam = bpy.data.objects.new("cam", cam_d)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    # The shots. Each one is a viewpoint, not an event: a wide establishing
    # frame, then closer on the two regions the named sites fall in, then a
    # slow orbit so the walkthrough has motion to scrub through.
    shots = []
    #
    # The first framing put the camera low and close, which cropped India out
    # of its own frame and made a diagram look like a games cutscene. These are
    # higher and further back: enough tilt to read as three dimensions, not so
    # much that the map stops being a map.
    shots.append(("wide", (0.0, -9.0, 15.5), (0.0, 0.8, 0.0)))
    shots.append(("north", (-0.6, -5.0, 9.0), (-1.0, 2.8, 0.0)))
    shots.append(("punjab", (1.4, -6.2, 8.0), (1.2, 0.4, 0.0)))
    steps = int(os.environ.get("SINDOOR_ORBIT", "14"))
    for i in range(steps):
        a = math.radians(-46 + (92.0 * i / max(1, steps - 1)))
        r, h = 7.6, 13.0
        shots.append((f"orbit{i:02d}", (math.sin(a) * r, -math.cos(a) * r, h), (0.0, 0.7, 0.0)))

    os.makedirs(OUT_DIR, exist_ok=True)
    scene = bpy.context.scene
    manifest = []
    for name, loc, target in shots:
        cam.location = Vector(loc)
        look_at(cam, target)
        path = os.path.join(OUT_DIR, f"{name}.webp")
        scene.render.filepath = path
        bpy.ops.render.render(write_still=True)
        manifest.append(name)
        print(f"  rendered {name}")

    # What the page needs to lay labels over the frames: where each pin landed
    # in the final orbit frame's screen space would require a projection the
    # page cannot redo, so the page labels in its own overlay instead and this
    # records only which frames exist and what is in them.
    json.dump({
        "note": (
            "Rendered by scripts/blender/sindoor-scene.py with Blender (bpy) on CPU Cycles, "
            "Freestyle line art. Country shapes are Natural Earth via world-atlas 10m; site "
            "positions come from the Sindoor book connector. No impact, blast or wreckage is "
            "drawn anywhere: what was hit and what was lost are the contested questions, and a "
            "drawing asserts without sourcing."
        ),
        "frames": manifest,
        "sitesInFrame": [
            {"id": s["id"], "name": s["name"], "kind": s.get("kind")} for s, _, _ in placed
        ],
    }, open(os.path.join(OUT_DIR, "frames.json"), "w"), indent=2)
    print(f"\nWrote {len(manifest)} frames to {OUT_DIR}")


main()
