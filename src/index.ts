import {ImGui, ImGui_Impl} from '@zhobo63/imgui-ts'
import { UIMgr } from '@zhobo63/zlui-ts';
import * as SPINE from './zlUISpine';
import { BackendImGui } from '@zhobo63/zlui-ts/src/BackendImGui';

class App
{
    constructor() {

    }

    async Initialize() {
        let path="res/"
        this.ui=new UIMgr;
        this.ui.backend=new BackendImGui(ImGui.GetBackgroundDrawList());
        SPINE.Renderer.Register(this.ui, 'assets/');
        await this.ui.Load("main.ui", path);
    }

    MainLoop(time:number, drawlist:ImGui.DrawList):void 
    {
        let io=ImGui.GetIO();
        let ui=this.ui;
        ui.any_pointer_down=(!ImGui.GetHoveredWindow())?ImGui_Impl.any_pointerdown():false;
        ui.mouse_pos.Set(io.MousePos.x, io.MousePos.y);
        ui.mouse_wheel=io.MouseWheel;
        ui.Refresh(io.DeltaTime);
        ui.Paint();
    }

    OnResize(width:number, height:number):void {
        this.ui.OnResize(width, height);
        SPINE.spineRenderer.OnResize(width, height);
    }

    isDirty:boolean;

    ui:UIMgr;
}

let app:App;

let lock_time=0;
let lock_fps=1/60;
let prev_time=0;

function _loop(time:number):void {
    let ti=(time-prev_time)*0.001;
    prev_time=time;
    lock_time+=ti;
    if(lock_time<lock_fps && !app.isDirty)  {
        window.requestAnimationFrame(_loop);
        return;
    }
    lock_time=0;

    ImGui_Impl.NewFrame(time);
    ImGui.NewFrame();

    if(app) {
        app.MainLoop(time, ImGui.GetBackgroundDrawList());
    }

    ImGui.EndFrame();
    ImGui.Render();

    ImGui_Impl.ClearBuffer(new ImGui.ImVec4(0.25,0.25,0.25,1));
    ImGui_Impl.RenderDrawData(ImGui.GetDrawData());


    app.isDirty=false;
    window.requestAnimationFrame(_loop);
}

function any_pointer(e:Event)
{
    app.isDirty=true;
}

window.addEventListener('DOMContentLoaded', async () =>{
    await ImGui.default();
    ImGui.CHECKVERSION();
    ImGui.CreateContext();
    let io=ImGui.GetIO();
    let font=io.Fonts.AddFontDefault();

    const canvas:HTMLCanvasElement=document.getElementById('canvas') as HTMLCanvasElement;
    ImGui_Impl.Init(canvas);

    app=new App;
    await app.Initialize();
    app.OnResize(canvas.scrollWidth, canvas.scrollHeight);

    window.addEventListener("pointerdown", any_pointer);
    window.addEventListener("pointerup", any_pointer);
    window.addEventListener("pointermove", any_pointer);
    window.addEventListener("keydown", any_pointer);
    window.addEventListener("keyup", any_pointer);
    window.addEventListener("keypress", any_pointer);    

    window.onresize=()=>{
        if(app) {app.OnResize(canvas.scrollWidth, canvas.scrollHeight);}
    }
    window.requestAnimationFrame(_loop);
})
