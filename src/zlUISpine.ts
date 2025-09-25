import { ImGui, ImGui_Impl } from "@zhobo63/imgui-ts";
import * as SPINE38 from "./spine-3.8/index";
import { ParseBool, Vec2, Transform, Parser, zlUIMgr, zlUIWin } from "@zhobo63/zlui-ts"
import { BackendImGui, PaintWin } from "@zhobo63/zlui-ts/src/BackendImGui"

const sleep = (milliseconds: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

function toImVec2(to:ImGui.Vec2, v:Vec2):ImGui.Vec2
{
    to.Set(v.x, v.y);
    return to;
}

function toMat4(tm: Transform, m: SPINE38.Matrix4): SPINE38.Matrix4 {
    m.values[SPINE38.M00]=tm.rotate.m11*tm.scale;
    m.values[SPINE38.M10]=tm.rotate.m21*tm.scale;
    m.values[SPINE38.M20]=0;
    m.values[SPINE38.M30]=0;
    m.values[SPINE38.M01]=tm.rotate.m12*tm.scale;
    m.values[SPINE38.M11]=tm.rotate.m22*tm.scale;
    m.values[SPINE38.M21]=0;
    m.values[SPINE38.M31]=0;
    m.values[SPINE38.M02]=0;
    m.values[SPINE38.M12]=0;
    m.values[SPINE38.M22]=0;
    m.values[SPINE38.M32]=0;
    m.values[SPINE38.M03]=tm.translate.x;
    m.values[SPINE38.M13]=tm.translate.y;
    m.values[SPINE38.M23]=0;
    m.values[SPINE38.M33]=1;
    return m;
}

class PaintSpine extends PaintWin
{
    constructor(backend:BackendImGui)
    {
        super(backend);
    }

    Paint()
    {
        let drawlist=this.drawlist;
        drawlist.AddCallback((parent_list, cmd)=>{
            let obj=cmd.UserCallbackData as zlUISpine;
            let m=toMat4(obj._world, obj.world);
            let wvp=m.multiplyLeft(spineRenderer.mat_project);
            obj.state.apply(obj.skeleton);
            obj.skeleton.updateWorldTransform();

            spineRenderer.RenderBegin(wvp);
            spineRenderer.skeletonRenderer.premultipliedAlpha=obj.premultipliedAlpha;
            spineRenderer.skeletonRenderer.draw(spineRenderer.batcher, obj.skeleton);

            spineRenderer.RenderEnd();
        }, this.obj);

        if(this.draw_bone) {
            let obj=this.obj as zlUISpine;
            let xy=obj._world.translate;
            for(let bone of obj.skeleton.bones) {
                this.v1.Set(bone.worldX, bone.worldY);
                let v1=obj._world.Transform(this.v1);
                this.vec_a.Set(v1.x-2, v1.y-2);
                this.vec_b.Set(v1.x+2, v1.y+2);
                let col=0xff0000ff;
                drawlist.AddRectFilled(this.vec_a, this.vec_b, col);
                drawlist.AddText(this.vec_a, col, bone.data.name);
                if(bone.parent) {
                    this.v2.Set(bone.parent.worldX, bone.parent.worldY);
                    let v2=obj._world.Transform(this.v2);
                    drawlist.AddLine(
                        toImVec2(this.vec_a, v1),
                        toImVec2(this.vec_b, v2),
                        col
                    )
                }
            }
        }
    }
    
    vec_a:ImGui.Vec2=new ImGui.Vec2;
    vec_b:ImGui.Vec2=new ImGui.Vec2;
    v1:Vec2=new Vec2;
    v2:Vec2=new Vec2;
    draw_bone:boolean=false;
}

export class zlUISpine extends zlUIWin
{
    constructor(own: zlUIMgr) {
        super(own);
        this._csid=zlUISpine.CSID;
    }
    static CSID="Spine";
    static Create(own:zlUIMgr):zlUIWin {
        return new zlUISpine(own);
    }
    async ParseCmd(name:string, toks:string[], parser:Parser):Promise<boolean>
    {
        switch(name) {
        case 'spine':
            await this.LoadSpine(toks[1], toks[2]);
            break;
        case 'ani':
            this.state.addAnimation(0,toks[1],true,0);
            break;
        case 'xy':
            this.skeleton.x=Number.parseFloat(toks[1]);
            this.skeleton.y=Number.parseFloat(toks[2]);
            break;
        case 'premultipliedalpha':
            this.premultipliedAlpha=ParseBool(toks[1]);
            break;
        default:
            return await super.ParseCmd(name,toks,parser);    
        }
        return true;        
    }

    async LoadSpine(atlas_name:string, skeleton_name:string) {
        spineRenderer.Load(atlas_name)
        .Load(skeleton_name);

        return new Promise((resolve, reject) => {
            spineRenderer.Wait(()=>{
                let atlas=spineRenderer.get(atlas_name);
                let atlasLoader=new SPINE38.AtlasAttachmentLoader(atlas);

                let is_json=skeleton_name.endsWith(".json");
                let skeleton_file:any=spineRenderer.get(skeleton_name);

                let skeletonLoader=is_json?new SPINE38.SkeletonJson(atlasLoader):new SPINE38.SkeletonBinary(atlasLoader);
                skeletonLoader.scale=1;
                let skeletonData=skeletonLoader.readSkeletonData(skeleton_file);

                this.skeleton=new SPINE38.Skeleton(skeletonData);
                this.skeleton.setSkinByName("default");
                let aniStateData=new SPINE38.AnimationStateData(this.skeleton.data);
                this.state=new SPINE38.AnimationState(aniStateData);
                this.skeleton.scaleY=-1;
                resolve(this);
            });
        });
    }

    Refresh(ti:number, parent?:zlUIWin):boolean 
    {
        this.state.update(ti);        
        return super.Refresh(ti, parent);
    }
    
    skeleton:SPINE38.Skeleton;
    state:SPINE38.AnimationState;
    premultipliedAlpha:boolean=true;
    world:SPINE38.Matrix4 = new SPINE38.Matrix4;
}

export class Renderer extends SPINE38.AssetManager
{
    constructor(gl:WebGL2RenderingContext|WebGLRenderingContext, path:string)
    {
        let ctx:SPINE38.ManagedWebGLRenderingContext=new SPINE38.ManagedWebGLRenderingContext(gl);
        super(ctx,path);
        this.skeletonRenderer=new SPINE38.SkeletonRenderer(ctx,false);
        this.batcher=new SPINE38.PolygonBatcher(ctx, false);
        this.shader=SPINE38.Shader.newColoredTextured(ctx);
    }

    static Register(mgr: zlUIMgr, path:string) {
        spineRenderer=new Renderer(ImGui_Impl.gl, path);
        mgr.create_func['spine']=zlUISpine.Create;
        mgr.backend.paint[zlUISpine.CSID]=new PaintSpine(mgr.backend as BackendImGui);
    }

    Load(res:string):Renderer
    {
        if(res.endsWith(".skel"))   {
            this.loadBinary(res);
        }
        else if(res.endsWith(".json"))   {
            this.loadText(res);
        }
        else if(res.endsWith(".atlas"))   {
            this.loadTextureAtlas(res);
        }
        return this;
    }
    async Wait(callback:()=>void) {
        while(!this.isLoadingComplete())    {
            await sleep(1);
        }
        callback();
    }

    OnResize(width:number, height:number):void 
    {
        this.mat_project.ortho(0,width,height,0,1,0);
    }

    RenderBegin(wvp:SPINE38.Matrix4)
    {
        let shader=this.shader;
        let batcher=this.batcher;
        shader.bind();
        shader.setUniformi(SPINE38.Shader.SAMPLER,0);
        shader.setUniform4x4f(SPINE38.Shader.MVP_MATRIX, wvp.values);
        batcher.begin(shader);
    }
    RenderEnd()
    {
        this.batcher.end()
        this.shader.unbind();
    }

    skeletonRenderer: SPINE38.SkeletonRenderer;
    batcher:SPINE38.PolygonBatcher;
    shader:SPINE38.Shader;
    mat_project:SPINE38.Matrix4=new SPINE38.Matrix4;
}

export let spineRenderer:Renderer;