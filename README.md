# zlui-ts-spine README

## Brief of `zlUISpine.ts`

`zlUISpine.ts` extends the `zlui-ts` library by integrating the Spine 2D animation runtime, allowing `zlui-ts` applications to display and control Spine animations.

**Key Features and Extensions:**

1.  **Spine Integration:**
    *   It imports Spine 3.8 runtime components (`SPINE38`) for handling skeleton data, animation states, and rendering.
    *   Introduces `zlUISpine` class which inherits from `zlUIWin` (the base `zlui-ts` UI component), making Spine animations behave like any other UI element.

2.  **Spine Animation Loading and Control:**
    *   **`spine <atlas_name> <skeleton_name>`**: This is a new parsing command for `zlUISpine` components. It loads a Spine atlas (`.atlas` file) and skeleton data (`.json` or `.skel` file) for the animation.
    *   **`ani <animation_name>`**: Plays a specified animation from the loaded Spine data.
    *   **`xy <x> <y>`**: Sets the position of the Spine skeleton within its UI component bounds.
    *   **`premultipliedalpha <bool>`**: Controls whether premultiplied alpha is used for rendering the Spine animation.

3.  **Rendering Backend Extension:**
    *   It extends the `BackendImGui` (an `zlui-ts` backend) with a `PaintSpine` class. This class is responsible for drawing Spine animations directly within the ImGui rendering context.
    *   It uses `SPINE38.SkeletonRenderer` and `SPINE38.PolygonBatcher` to render the Spine skeletons.
    *   Includes logic for drawing individual bones for debugging purposes (if `draw_bone` is enabled in `PaintSpine`).

4.  **Asset Management:**
    *   A `Renderer` class, inheriting from `SPINE38.AssetManager`, is introduced to handle loading Spine assets (atlas, skeleton files). It includes `Load` and `Wait` methods for asynchronous loading.
    *   `Renderer.Register` statically registers the `zlUISpine` component with the `zlUIMgr` (UI Manager) and hooks into the `zlui-ts` rendering pipeline.

5.  **Coordinate Transformation:**
    *   Provides helper functions like `toImVec2` and `toMat4` to convert `zlui-ts`'s `Vec2` and `Transform` objects to Spine's `ImGui.Vec2` and `SPINE38.Matrix4` formats, ensuring correct positioning and scaling of Spine animations within the `zlui-ts` UI.

In essence, `zlUISpine.ts` acts as a bridge, allowing `zlui-ts` to render complex 2D Spine animations as native UI elements, managed by the existing `zlui-ts` layout and event system.

## Example

### Initialize 

```ts
this.ui=new UIMgr;
this.ui.backend=new BackendImGui(ImGui.GetBackgroundDrawList());
SPINE.Renderer.Register(this.ui, 'assets/');
```

### Loading

```ts
Object Spine
{
    Name spineboy
    RectWH 250 895 0 0
    Spine spineboy-pma.atlas spineboy-pro.skel
    Ani walk
}
```