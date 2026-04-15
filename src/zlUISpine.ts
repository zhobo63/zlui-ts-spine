import { ImGui_Impl } from "@zhobo63/imgui-ts";
import * as SPINE38 from "./spine-3.8/index";
import { ParseBool, Vec2, Transform, Parser, zlUIMgr, zlUIWin, Vec4 } from "@zhobo63/zlui-ts"
import { BackendImGui, PaintWin, toImVec2, vec_a, vec_b } from "@zhobo63/zlui-ts/src/BackendImGui"

const sleep = (milliseconds: number): Promise<void> => {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

const draw_bone = false;

function toMat4(tm: Transform, m: SPINE38.Matrix4): SPINE38.Matrix4 {
    m.values[SPINE38.M00]=tm.rotate.m11*tm.scale.x;
    m.values[SPINE38.M10]=tm.rotate.m21*tm.scale.y;
    m.values[SPINE38.M20]=0;
    m.values[SPINE38.M30]=0;
    m.values[SPINE38.M01]=tm.rotate.m12*tm.scale.x;
    m.values[SPINE38.M11]=tm.rotate.m22*tm.scale.y;
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
        let obj=this.obj as zlUISpine;
        if(!obj.state)
            return;

        let drawlist=this.drawlist;
        drawlist.AddCallback((parent_list, cmd)=>{
            let obj=cmd.UserCallbackData as zlUISpine;
            obj.skeleton.x=obj.xy.x;
            obj.skeleton.y=obj.xy.y;
            obj.skeleton.scaleX=obj.scale_xy.x;
            obj.skeleton.scaleY=-obj.scale_xy.y;

            let m=toMat4(obj._world, obj.world);
            let wvp=m.multiplyLeft(spineRenderer.mat_project);
            obj.state.apply(obj.skeleton);
            obj.skeleton.updateWorldTransform();
            obj.skeleton.color.r=obj.color.x;
            obj.skeleton.color.g=obj.color.y;
            obj.skeleton.color.b=obj.color.z;
            obj.skeleton.color.a=obj.alpha*obj.color.w;

            if(obj.on_spine_update) {
                obj.on_spine_update();
            }

            spineRenderer.RenderBegin(wvp);
            spineRenderer.skeletonRenderer.premultipliedAlpha=obj.premultipliedAlpha;
            spineRenderer.skeletonRenderer.draw(spineRenderer.batcher, obj.skeleton);

            spineRenderer.RenderEnd();
        }, this.obj);

        //Draw Bone
        if(draw_bone) {
            let obj=this.obj as zlUISpine;
            let col=0xff0000ff;
            let xy=obj._world.translate;
            let scale=obj._world.scale;
            for(let bone of obj.skeleton.bones) {
                this.v1.Set(bone.worldX, bone.worldY);
                let v1=obj._world.Transform(this.v1);
                vec_a.Set(v1.x-2, v1.y-2);
                vec_b.Set(v1.x+2, v1.y+2);
                drawlist.AddRectFilled(
                    vec_a,
                    vec_b,
                    col
                )
                if(bone.parent) {
                    this.v2.Set(bone.parent.worldX, bone.parent.worldY);
                    let v2=obj._world.Transform(this.v2);
                    drawlist.AddLine(
                        toImVec2(vec_a, v1),
                        toImVec2(vec_b, v2),
                        col
                    )
                }
            }
        }
    }    

    v1=new Vec2;
    v2=new Vec2;
}

export {zlUISpine as UISpine}

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
            this.atlas=toks[1];
            this.skel=toks[2];
            await this.LoadSpine(this.atlas, this.skel);
            break;
        case 'ani':
            this.ani=toks[2];
            this.state.addAnimation(0,this.ani,true,0);
            break;
        case 'xy':            
        case 'pos':
            this.xy.Set(Number.parseFloat(toks[1]), Number.parseFloat(toks[2]));
            break;
        case 'scalexy':
            this.scale_xy.Set(Number.parseFloat(toks[1]), Number.parseFloat(toks[2]));
            break;
        case 'premultipliedalpha':
            this.premultipliedAlpha=ParseBool(toks[1]);
            break;
        default:
            return await super.ParseCmd(name,toks,parser);    
        }
        return true;        
    }

    Copy(obj:zlUIWin):void
    {
        super.Copy(obj);
        let o=obj as zlUISpine;
        this.atlas=o.atlas;
        this.skel=o.skel;
        this.ani=o.ani;
        this.skin=o.skin;
        this.premultipliedAlpha=o.premultipliedAlpha;
        this.xy.Set(o.xy.x, o.xy.y);
        this.scale_xy.Set(o.scale_xy.x, o.scale_xy.y);

        if(this.atlas && this.skel) {
            this.LoadSpine(this.atlas, this.skel).then(v=>{
                if(this.ani) {
                    this.state.addAnimation(0, this.ani, true, 0);
                }
            })
        }
    }
    Clone():zlUIWin
    {
        let obj=new zlUISpine(this._owner)
        obj.Copy(this);
        return obj;
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
                this.skeleton.setSkinByName(this.skin);
                let aniStateData=new SPINE38.AnimationStateData(this.skeleton.data);
                this.state=new SPINE38.AnimationState(aniStateData);
                this.skeleton.x=this.xy.x;
                this.skeleton.y=this.xy.y;
                this.skeleton.scaleX=this.scale_xy.x;
                this.skeleton.scaleY=-this.scale_xy.y;

                let listener={
                    start:this.onSpineStart.bind(this),
                    end:()=>{},
                    complete:this.onSpineComplete.bind(this),
                    event:()=>{},
                    interrupt:()=>{},
                    dispose:()=>{},
                };
                this.state.addListener(listener);

                resolve(this);
            });
        });
    }

    Refresh(ti:number, parent?:zlUIWin):boolean 
    {
        if(this.state) {
            this.state.update(ti*this.speed);
        }
        return super.Refresh(ti, parent);
    }

    SetSkin(name:string) {
        this.skin=name;
        if(this.skeleton) {
            this.skeleton.setSkinByName(name);
            this.skeleton.setSlotsToSetupPose();
        }
    }

    Play(name:string,loop:boolean, delay:number,on_complete?:()=>void): SPINE38.TrackEntry|undefined {
        let entry:SPINE38.TrackEntry|undefined;
        if(this.state) {
            if(on_complete) {
                this.on_spine_complete[name]=on_complete;
            }
            entry=this.state.addAnimation(0,name,loop,delay);            
        }
        return entry;
    }
    ClearTracks() {
        if(this.state) {
            this.state.clearTracks();
        }
        if(this.skeleton) {
            this.skeleton.setToSetupPose();
        }
    }

    GetBone(name:string):SPINE38.Bone|undefined {
        let bone;
        if(this.skeleton) {
            bone=this.skeleton.bones.find(v=>v.data.name==name);
        }
        return bone;
    }

    GetSlot(name:string):SPINE38.Slot|undefined {
        let slot;
        if(this.skeleton) {
            slot=this.skeleton.slots.find(v=>v.data.name==name);
        }
        return slot;
    }

    onSpineStart(entry:SPINE38.TrackEntry) {
        let on_start=this.on_spine_start[entry.animation.name];
        if(on_start) {
            on_start();
        }
        //console.log(`on_spine_start ${entry.animation.name}`, entry);
    }
    onSpineComplete(entry:SPINE38.TrackEntry) {
        let on_complete=this.on_spine_complete[entry.animation.name];
        if(on_complete) {
            on_complete();
        }
    }
    
    skeleton!:SPINE38.Skeleton;
    state!:SPINE38.AnimationState;
    premultipliedAlpha:boolean=true;
    world:SPINE38.Matrix4 = new SPINE38.Matrix4;
    xy:Vec2=new Vec2;
    scale_xy:Vec2=new Vec2(1,1);
    atlas?:string;
    skel?:string;
    skin:string="default";
    ani?:string;
    color:Vec4=new Vec4(1,1,1,1);
    speed:number=1;

    on_spine_start:{[key:string]:()=>void}={}
    on_spine_complete:{[key:string]:()=>void}={}
    on_spine_update?:()=>void;
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
        spineRenderer=new Renderer(<WebGL2RenderingContext|WebGLRenderingContext>ImGui_Impl.gl, path);
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