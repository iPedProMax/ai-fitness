"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {AddMealButton} from "@/components/add-meal-button";
import {makeManualFoodAnalysis,type ManualFoodInput} from "@/lib/manual-food";
import {nutritionForGrams,type CatalogFood,validBarcode} from "@/lib/open-food-facts";
import { FoodSmartSearch } from "@/components/food-smart-search";
import {readCatalogCache,saveCatalogCache} from "@/lib/barcode-cache";
import {catalogSourceLabel} from "@/lib/catalog-source-label";
import {suggestedServings} from "@/lib/serving-options";
import {validateBarcodeImageFile} from "@/lib/barcode-image";
import {findMyBarcodeFood,saveMyBarcodeFood} from "@/app/barcode/actions";
import {personalFoodFromServing} from "@/lib/personal-barcode-food";
import type {FoodAnalysis} from "@/lib/food-analysis";
import {BarcodeAiTextAssist} from "@/components/barcode-ai-text-assist";
import type { AiProviderChoice } from "@/components/ai-provider-picker";
import type { AiModelStatus } from "@/lib/ai/model-catalog";
import { readyTextAiIds } from "@/lib/ai/text-readiness";
import {missingBarcodeTextAiDraft} from "@/lib/barcode-ai-prefill";
import {barcodeNutritionCoverage} from "@/lib/nutrition-coverage";

type NutritionKey="calories"|"protein"|"carbs"|"fat"|"fiberG"|"sugarG"|"addedSugarG"|"sodiumMg"|"cholesterolMg"|"potassiumMg"|"calciumMg"|"ironMg"|"vitaminDMcg";
const fields= [["Calories","calories","kcal"],["Protein","protein","g"],["Carbs","carbs","g"],["Fat","fat","g"]] as const;
const advancedFields= [["Fiber","fiberG","g"],["Total sugar","sugarG","g"],["Sodium","sodiumMg","mg"],["Cholesterol","cholesterolMg","mg"],["Potassium","potassiumMg","mg"],["Calcium","calciumMg","mg"],["Iron","ironMg","mg"],["Vitamin D","vitaminDMcg","mcg"]] as const;
const emptyManual:ManualFoodInput={name:"",grams:"",calories:"",protein:"",carbs:"",fat:""};
export function BarcodeLookup(){
  const [barcode,setBarcode]=useState("");const [search,setSearch]=useState("");
  const [foods,setFoods]=useState<CatalogFood[]>([]);const [selected,setSelected]=useState<CatalogFood|null>(null);
  const [grams,setGrams]=useState("100");const [analysis,setAnalysis]=useState<FoodAnalysis|null>(null);
  const [corrections,setCorrections]=useState<Partial<Record<NutritionKey,string>>>({});
  const [busy,setBusy]=useState(false);const [scanning,setScanning]=useState(false);
  const [message,setMessage]=useState("");const [noResult,setNoResult]=useState(false);
  const [cachedAt,setCachedAt]=useState<number|null>(null);
  const [catalogSource,setCatalogSource]=useState("Open Food Facts");
  const [manualOpen,setManualOpen]=useState(false);
  const [fromMyFoods,setFromMyFoods]=useState(false);
  const [myFoodNotice,setMyFoodNotice]=useState("");
  const [savingMyFood,setSavingMyFood]=useState(false);
  const [textAiOpen,setTextAiOpen]=useState(false);
  const [textAiNotice,setTextAiNotice]=useState("");
  const [textAiProvider,setTextAiProvider]=useState<AiProviderChoice|null>(null);
  const [textAiStatuses,setTextAiStatuses]=useState<AiModelStatus[]|null>(null);
  const [localTextReady,setLocalTextReady]=useState(false);
  const [aiSuggested,setAiSuggested]=useState(false);
  const [decodingImage,setDecodingImage]=useState(false);
  const [imagePreview,setImagePreview]=useState<string|null>(null);
  const [imageLabel,setImageLabel]=useState("");
  const [manualValues,setManualValues]=useState<ManualFoodInput>(emptyManual);
  const [manualAnalysis,setManualAnalysis]=useState<FoodAnalysis|null>(null);
  const videoRef=useRef<HTMLVideoElement|null>(null);
  const controlsRef=useRef<{stop:()=>void}|null>(null);
  const sessionRef=useRef(0);
  const lookupLock=useRef(false);
  const imageInputRef=useRef<HTMLInputElement|null>(null);
  const uploadedImageUrlRef=useRef<string|null>(null);
  const imageRunRef=useRef(0);

  function stopCamera(){
    sessionRef.current += 1;
    try{controlsRef.current?.stop();}catch{/* camera already stopped */}
    controlsRef.current=null;
    const video=videoRef.current;
    const stream=video?.srcObject;
    if(typeof MediaStream!=="undefined"&&stream instanceof MediaStream)stream.getTracks().forEach(track=>track.stop());
    if(video)video.srcObject=null;
    setScanning(false);
  }
  useEffect(()=>()=>{
    sessionRef.current+=1;
    imageRunRef.current+=1;
    if(uploadedImageUrlRef.current)URL.revokeObjectURL(uploadedImageUrlRef.current);
    try{controlsRef.current?.stop();}catch{/* already stopped */}
    const stream=videoRef.current?.srcObject;
    if(typeof MediaStream!=="undefined"&&stream instanceof MediaStream)stream.getTracks().forEach(track=>track.stop());
  },[]);

  // The optional Text AI preference is visible immediately in Barcode,
  // independent of product lookup, meal saving, or AI form visibility.
  // Server readiness remains the only source of model availability.
  useEffect(() => {
    const controller=new AbortController();
    fetch("/api/ai/models",{cache:"no-store",signal:controller.signal})
      .then(async response=>response.ok?await response.json():null)
      .then(data=>{if(!controller.signal.aborted)setTextAiStatuses(Array.isArray(data?.models)?data.models as AiModelStatus[]:[]);})
      .catch(()=>{if(!controller.signal.aborted)setTextAiStatuses([]);});
    fetch("/api/coach/local",{cache:"no-store",signal:controller.signal})
      .then(async response=>response.ok?await response.json():null)
      .then(data=>{if(!controller.signal.aborted)setLocalTextReady(data?.available===true);})
      .catch(()=>{if(!controller.signal.aborted)setLocalTextReady(false);});
    return ()=>controller.abort();
  },[]);

  async function lookup(type:"barcode"|"q",value:string){
    if(lookupLock.current)return;
    lookupLock.current=true;setBusy(true);setMessage("");setNoResult(false);
    setSelected(null);setAnalysis(null);setManualAnalysis(null);setFoods([]);setCachedAt(null);setCatalogSource("Open Food Facts");
    setFromMyFoods(false);setMyFoodNotice("");setAiSuggested(false);setTextAiNotice("");setTextAiOpen(false);
    try{
      // Personal barcode entries take priority over community data and device cache.
      if(type==="barcode"){
        const own=await findMyBarcodeFood(value);
        if(own.status==="found"){
          setCatalogSource("Your saved food");setFoods([own.food]);choose(own.food,true);return;
        }
        if(own.status==="error")setMyFoodNotice(own.message);
      }
      // Do not let a stale device-level community cache mask a newly reviewed exact barcode.
      const cached=type === "barcode" ? null : readCatalogCache(type,value);
      if(cached){
        setFoods(cached.foods);setCachedAt(cached.fetchedAt);
        if(cached.foods.length===1)choose(cached.foods[0]);
        return;
      }
      const response=await fetch(`/api/food/catalog?${type}=${encodeURIComponent(value)}`,{cache:"no-store"});
      const data:unknown=await response.json();
      const result=data&&typeof data==="object"?data as Record<string,unknown>:{};
      setCatalogSource(catalogSourceLabel(result.source));
      if(!response.ok)throw new Error(typeof result.error==="string"?result.error:"Food lookup unavailable.");
      const matches=Array.isArray(result.foods)?result.foods as CatalogFood[]:[];
      setFoods(matches);
      if(matches.length===1)choose(matches[0]);
      if(matches.length===0){setNoResult(true);setMessage("This barcode isn't in the product database yet. Choose AI autofill or free manual entry below.");}
      else if(type === "q") saveCatalogCache(type,value,matches);
    }catch(issue){setNoResult(true);setMessage(issue instanceof Error?issue.message:"Lookup unavailable.");}
    finally{lookupLock.current=false;setBusy(false);}
  }


  // A searched product opens the existing barcode flow, without adding a new API or AI call.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") !== "barcode") return;
    const fromLibrary = params.get("barcode")?.trim() ?? "";
    if (!validBarcode(fromLibrary)) return;
    setBarcode(fromLibrary);
    void lookup("barcode", fromLibrary);
    // Intentionally read the deep-link barcode only when the component mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Image stays in the browser. Only the decoded digits go to the product API. */
  async function readBarcodeImage(file:File){
    if(lookupLock.current || decodingImage){
      setMessage("A barcode lookup is already running. Try again when it finishes.");
      return;
    }
    const problem=validateBarcodeImageFile(file);
    if(problem){setMessage(problem);return;}
    stopCamera();
    const run=++imageRunRef.current;
    if(uploadedImageUrlRef.current)URL.revokeObjectURL(uploadedImageUrlRef.current);
    const url=URL.createObjectURL(file);
    uploadedImageUrlRef.current=url;
    setImagePreview(url);
    setImageLabel(file.name);
    setDecodingImage(true);
    setNoResult(false);
    setMessage("Reading the barcode from your image on this device...");
    try{
      const {BrowserMultiFormatOneDReader}=await import("@zxing/browser");
      if(run!==imageRunRef.current)return;
      const reader=new BrowserMultiFormatOneDReader();
      const result=await reader.decodeFromImageUrl(url);
      if(run!==imageRunRef.current)return;
      const raw=result.getText().trim();
      if(!validBarcode(raw)){
        setMessage("A barcode was detected, but it wasn't a supported 8–14 digit product code. Try another image or enter the number manually.");
        return;
      }
      setBarcode(raw);
      await lookup("barcode",raw);
    }catch{
      if(run===imageRunRef.current){
        setMessage("Couldn't read a barcode from that image. Try a clear, well-lit, uncropped barcode photo with the full bars visible, or type the barcode below.");
      }
    }finally{
      if(run===imageRunRef.current)setDecodingImage(false);
    }
  }

  async function startCamera(){
    if(!navigator.mediaDevices?.getUserMedia){setMessage("Camera scanning requires HTTPS or localhost. Enter the barcode manually or use a package photo.");return;}
    const video=videoRef.current;if(!video)return;
    stopCamera();setScanning(true);setMessage("Point your camera at the barcode. The scanner runs on your device.");
    const session=++sessionRef.current;
    try{
      // Loaded only after the user asks for a camera; no server-side camera code.
      const {BrowserMultiFormatOneDReader}=await import("@zxing/browser");
      if(session!==sessionRef.current)return;
      const reader=new BrowserMultiFormatOneDReader();
      const controls=await reader.decodeFromVideoDevice(undefined,video,(result,_error,scannerControls)=>{
        if(session!==sessionRef.current||!result)return;
        const raw=result.getText();
        if(!validBarcode(raw))return;
        scannerControls.stop();stopCamera();setBarcode(raw);
        void lookup("barcode",raw);
      });
      if(session!==sessionRef.current){controls.stop();return;}
      controlsRef.current=controls;
    }catch{
      if(session===sessionRef.current){stopCamera();setMessage("Camera scanner couldn't start. Check camera permission and HTTPS, or enter the barcode manually.");}
    }
  }
  function choose(food:CatalogFood,personal=false){
    setSelected(food);setFromMyFoods(personal);setTextAiOpen(false);setTextAiNotice("");
    setGrams(String(suggestedServings(food)[0]?.grams??100));
    setCorrections({});setAnalysis(null);setMessage("");setManualOpen(false);setAiSuggested(false);
  }
  function preview(){
    if(!selected)return;
    try{
      const input={...nutritionForGrams(selected,Number(grams)),...corrections};
      const basic=makeManualFoodAnalysis([input], {aiAssisted:aiSuggested});
      setAnalysis({...basic,notes:aiSuggested?`Approximate Text AI estimates filled some previously missing fields; all values require user review. This barcode does not verify nutrition.`:fromMyFoods?`My Foods user-reviewed nutrition for barcode ${selected.barcode}; not independently verified.`:`Open Food Facts community-contributed nutrition, barcode ${selected.barcode}; serving reviewed by user. Product data: ODbL, openfoodfacts.org.`});setMessage("");
    }catch(issue){setAnalysis(null);setMessage(issue instanceof Error?issue.message:"Check serving size.");}
  }
  async function rememberFood(mode:"selected"|"manual"){
    const isSelected=mode==="selected";
    const food=isSelected?selected:null;
    const source=aiSuggested?"ai_reviewed" as const:"user_reviewed" as const;
    const base=food ?? {barcode:barcode.trim(),name:manualValues.name.trim(),brand:"",servingDescription:"",packageDescription:""};
    if(!validBarcode(base.barcode)){
      setMyFoodNotice("Scan or enter a valid barcode before saving to My Foods.");return;
    }
    let data;
    try{
      const input=isSelected?{...nutritionForGrams(food!,Number(grams)),...corrections}:manualValues;
      data=personalFoodFromServing(base,Number(isSelected?grams:manualValues.grams),input,source);
    }catch(error){
      const friendly = error instanceof Error && error.name !== "ZodError"
        ? error.message : "Check the barcode, portion and nutrition before saving to My Foods.";
      setMyFoodNotice(friendly);
      return;
    }
    setSavingMyFood(true);setMyFoodNotice("");
    try{
      const result=await saveMyBarcodeFood(data);
      if(!result.ok){setMyFoodNotice(result.message);return;}
      setMyFoodNotice("Saved to My Foods! Next time this barcode is looked up, your reviewed values will be used first.");
      setFromMyFoods(true);
      if(isSelected&&food){setSelected({...food,calories100g:data.calories100g,protein100g:data.protein100g,carbs100g:data.carbs100g,fat100g:data.fat100g});}
    }catch{setMyFoodNotice("My Foods could not be saved. Please retry.");}
    finally{setSavingMyFood(false);}
  }

  function applyTextAiDraft(food:FoodAnalysis["foods"][number], productName:string, portionGrams:string){
    try{
      const enteredGrams=portionGrams.trim()?Number(portionGrams):null;
      if(selected){
        const targetGrams=enteredGrams??Number(grams);
        const current={...nutritionForGrams(selected,targetGrams),...corrections};
        const suggested=missingBarcodeTextAiDraft(current,food,targetGrams);
        setGrams(String(targetGrams));
        setCorrections(previous=>({...previous,...suggested}));
        setAnalysis(null);
      }else{
        const amount=enteredGrams??(manualValues.grams.trim()?Number(manualValues.grams):null);
        const suggested=missingBarcodeTextAiDraft(manualValues,food,amount);
        setManualValues(previous=>({...previous,
          name:previous.name.trim()||productName.slice(0,120),
          ...(enteredGrams!==null?{grams:String(enteredGrams)}:{}),
          ...suggested}));
        setManualOpen(true);
        setManualAnalysis(null);
      }
      setAiSuggested(true);
      setTextAiOpen(false);
      setTextAiNotice("Text AI drafted approximate missing calories/macros. Existing known values were preserved. Review the amounts against your real package before saving.");
    }catch(error){
      setTextAiNotice(error instanceof Error?error.message:"Check the portion size before applying this Text AI estimate.");
    }
  }

  function manualPreview(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    try{
      const basic=makeManualFoodAnalysis([manualValues], {aiAssisted:aiSuggested});
      setManualAnalysis({...basic,notes:aiSuggested?"Approximate nutrition drafted by Text AI and reviewed by the user; barcode alone did not verify the values.":"User-entered nutrition for a product not found in Open Food Facts. Values were not AI-verified."});setMessage("");
    }catch(issue){setManualAnalysis(null);setMessage(issue instanceof Error?issue.message:"Check nutrition values.");}
  }
  const portion=selected?nutritionForGrams(selected,Number(grams)>0&&Number(grams)<=2000?Number(grams):100):null;
  const choices=selected?suggestedServings(selected):[];
  // Instant diary action uses the same validated manual-food model as Review.
  // Never invent missing values: if the record cannot be logged, keep manual review.
  const quickLogAnalysis: FoodAnalysis | null = (() => {
    if (!selected) return null;
    const n = Number(grams);
    if (!Number.isFinite(n) || n <= 0 || n > 2000) return null;
    try {
      const input = { ...nutritionForGrams(selected, n), ...corrections };
      return makeManualFoodAnalysis([input]);
    } catch { return null; }
  })();
  // Catalog nutrition is auto-populated by nutritionForGrams; an identified name alone
  // does not imply available calories/macros. User edits are preserved separately.
  const catalogCoverage=portion?barcodeNutritionCoverage(portion):null;
  const currentCoverage=portion?barcodeNutritionCoverage({
    calories:corrections.calories??portion.calories,
    protein:corrections.protein??portion.protein,
    carbs:corrections.carbs??portion.carbs,
    fat:corrections.fat??portion.fat,
  }):null;
  const readyBarcodeTextIds=readyTextAiIds(textAiStatuses).filter(id=>id!=="ollama-local"||localTextReady);
  const chosenBarcodeTextProvider:AiProviderChoice|undefined=
    textAiProvider&&readyBarcodeTextIds.includes(textAiProvider)
      ?textAiProvider
      :readyBarcodeTextIds[0] as AiProviderChoice|undefined;
  return <div className="khalories-barcode-flow space-y-6">
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Scan a food barcode</h2><a href="/foods" className="rounded-lg border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">Browse Philippine Food Library</a></div>
      <p className="text-sm text-slate-600">No AI credits for barcode lookups. For products in Open Food Facts, review the nutrition label before saving.</p>
      <div role="region" aria-label="Optional Barcode Text AI model" className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-extrabold uppercase tracking-wide text-emerald-800">Optional · Text AI</p>
            <h3 className="mt-1 text-base font-extrabold text-slate-900">Choose your nutrition AI</h3>
            <p className="mt-1 text-xs leading-5 text-slate-700">First, find a product for free. If nutrition is missing, you can ask your chosen AI to estimate it. The barcode itself is not nutrition evidence.</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-800">1 credit only when you run AI</span>
        </div>
        <label htmlFor="barcode-text-ai-provider" className="mt-3 block text-sm font-bold text-slate-900">Text AI provider</label>
        <select id="barcode-text-ai-provider" value={chosenBarcodeTextProvider??""}
          onChange={event=>setTextAiProvider(event.target.value as AiProviderChoice)}
          disabled={textAiStatuses===null||readyBarcodeTextIds.length===0}
          aria-describedby="barcode-text-ai-provider-help"
          className="mt-1.5 min-h-11 w-full cursor-pointer rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-70">
          {textAiStatuses===null?<option value="">Checking AI availability...</option>
            :readyBarcodeTextIds.length===0?<option value="">No Text AI available — free lookup still works</option>
            :readyBarcodeTextIds.map(id=><option key={id} value={id}>{textAiStatuses.find(s=>s.id===id)?.name??id}</option>)}
        </select>
        <p id="barcode-text-ai-provider-help" role="status" className="mt-2 text-xs leading-5 text-slate-700">
          {textAiStatuses===null?"Checking which Text AI models your account can use..."
            :readyBarcodeTextIds.length===0?"No approved Text AI is available right now. Barcode lookup and manual entry remain free."
            :`${readyBarcodeTextIds.length} Text AI model${readyBarcodeTextIds.length===1?"":"s"} available. Choosing a provider uses 0 credits; only requesting an estimate uses 1 credit.`}
        </p>
      </div>
      <button type="button" disabled={decodingImage||busy} onClick={()=>scanning?stopCamera():void startCamera()} className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">{scanning?"Stop camera":"Open camera scanner"}</button>
      <video ref={videoRef} muted playsInline autoPlay aria-label="Live barcode camera preview" className={`max-h-80 w-full rounded-xl bg-black object-contain ${scanning?"":"hidden"}`}/>
      <div className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50/50 p-4"
        onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect="copy";}}
        onDrop={e=>{e.preventDefault();if(!busy&&!decodingImage&&e.dataTransfer.files[0])void readBarcodeImage(e.dataTransfer.files[0]);}}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="text-sm font-bold text-slate-900">Or upload a barcode photo</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">Choose a saved photo or screenshot, or drag it here. JPEG, PNG or WEBP; up to 10 MB. No AI credit.</p></div>
          <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp"
            aria-label="Choose an image containing a product barcode" className="sr-only"
            onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";if(file)void readBarcodeImage(file);}}/>
          <button type="button" disabled={busy||decodingImage}
            onClick={()=>imageInputRef.current?.click()}
            className="cursor-pointer rounded-xl border border-emerald-500 bg-white px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-50">
            {decodingImage?"Reading image...":"Choose barcode image"}
          </button>
        </div>
        {imagePreview&&<div className="mt-3 flex flex-wrap items-center gap-3">
          <img src={imagePreview} alt="Your selected barcode image preview" className="h-28 w-36 rounded-lg border border-slate-200 bg-white object-contain"/>
          <p className="max-w-64 break-all text-xs text-slate-600">{imageLabel}</p>
        </div>}
        <p className="mt-2 text-xs text-slate-600">Image decoding happens in your browser. Only recognized barcode digits are sent to the food database.</p>
      </div>
      <form onSubmit={(event:FormEvent)=>{event.preventDefault();stopCamera();void lookup("barcode",barcode.trim());}} className="flex flex-wrap gap-2">
        <label className="min-w-48 flex-1 text-sm font-semibold">Barcode number<input value={barcode} onChange={e=>setBarcode(e.target.value.replace(/\D/g,""))} inputMode="numeric" maxLength={14} placeholder="8–14 digits" className="mt-1 w-full rounded-lg border border-slate-300 p-3"/></label>
        <button type="submit" disabled={!validBarcode(barcode)||busy||decodingImage} className="self-end cursor-pointer rounded-lg border border-slate-300 px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50">Find product</button>
      </form>
      <FoodSmartSearch mode="barcode" onQueryChange={setSearch} onSelect={(food, source) => {
        // Exact product choice: use source-backed nutrient values, no AI call.
        setCatalogSource(source);
        choose(food);
        setBarcode(food.barcode);
        setNoResult(false);
        setFoods([food]);
        setMessage(`Selected ${food.name}. Available nutrition filled below; review the exact variant and serving.`);
      }}/>
      {busy&&<p role="status" className="text-sm text-slate-500">Searching the product database...</p>}
      {cachedAt!==null&&<p className="text-xs text-slate-500">Loaded from this device's saved product cache (up to 24 hours old). Check packaging for updates.</p>}
      {message&&<p role="status" className="text-sm text-amber-800">{message}</p>}
      {myFoodNotice&&!analysis&&!manualAnalysis&&<p role="status" aria-live="polite" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-800">{myFoodNotice}</p>}
      {foods.length>1&&<div className="space-y-2"><h3 className="font-semibold">Choose the correct product</h3>{foods.map(food=><button key={food.barcode} type="button" onClick={()=>choose(food)} className="block w-full cursor-pointer rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-400"><strong>{food.name}</strong><span className="block text-xs text-slate-500">{food.brand} · {food.barcode}</span></button>)}</div>}
      {noResult&&<div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4" role="region" aria-label="Barcode not found options">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0"><h3 className="text-sm font-extrabold text-slate-900">Product not found? You still have options.</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600">AI can suggest missing macros from a product name, or you can enter the package values yourself.</p></div>
          <button type="button" aria-expanded={textAiOpen} aria-controls="barcode-ai-text" onClick={()=>setTextAiOpen(open=>!open)}
            className="min-h-10 cursor-pointer rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800">{textAiOpen?"Close AI helper":"✦ Try AI autofill"}</button>
        </div>
        {textAiOpen&&<div className="mt-3"><BarcodeAiTextAssist
          barcode={barcode}
          initialName={manualValues.name||search}
          initialGrams={manualValues.grams}
          preferredProvider={chosenBarcodeTextProvider} onDraft={applyTextAiDraft}
        /></div>}
      </div>}
      {(noResult||foods.length>0)&&<div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={()=>{
          setManualOpen(open=>!open);setManualAnalysis(null);
          if(!manualOpen&&selected)setManualValues({...nutritionForGrams(selected,Number(grams)),name:selected.name});
        }} className="cursor-pointer rounded-xl border border-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">{manualOpen?"Hide manual entry":"Enter nutrition manually - free"}</button>
      </div>}
      {manualOpen&&<form onSubmit={manualPreview} className="space-y-3 rounded-xl bg-slate-50 p-4" aria-label="Manual packaged food entry">
        <p className="text-sm font-semibold">Copy the values from the package label</p>
        <label className="block text-sm">Product name<input required value={manualValues.name} onChange={e=>{setManualValues(v=>({...v,name:e.target.value}));setManualAnalysis(null);}} maxLength={120} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3" placeholder="e.g. canned tuna"/></label>
        <label className="block text-sm">Amount eaten in grams (optional)<input value={manualValues.grams} onChange={e=>{setManualValues(v=>({...v,grams:e.target.value}));setManualAnalysis(null);}} type="number" min="0" max="2000" step="any" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3"/></label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{fields.map(([label,key,unit])=><label key={key} className="text-xs font-medium">{label} ({unit})<input type="number" step="any" min="0" value={manualValues[key]} onChange={e=>{setManualValues(v=>({...v,[key]:e.target.value}));setManualAnalysis(null);}} placeholder="Unknown" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"/></label>)}</div>
        <details className="rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold">Additional nutrients (optional)</summary><div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">{advancedFields.map(([label,key,unit])=><label key={key} className="text-xs font-medium">{label} ({unit})<input type="number" min="0" step="any" placeholder="Unknown" value={manualValues[key]??""} onChange={e=>{setManualValues(v=>({...v,[key]:e.target.value}));setManualAnalysis(null);}} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"/></label>)}</div></details>
        <p className="text-xs text-slate-600">Enter the values for the amount you ate, not the package's per-100 g numbers unless you ate 100 g. Calories are required unless all three macros are known.</p>
        <button type="submit" className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">Review manual food</button>
        {manualAnalysis&&<div className="space-y-2"><strong>{Math.round(manualAnalysis.totalCalories)} kcal</strong><AddMealButton analysis={manualAnalysis}/>
          <button type="button" disabled={savingMyFood} onClick={()=>void rememberFood("manual")} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-5 py-3 text-sm font-extrabold text-white shadow-md shadow-emerald-900/20 transition hover:border-emerald-800 hover:bg-emerald-800 hover:shadow-lg active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"><span aria-hidden="true">💾</span>{savingMyFood?"Saving...":"Save this barcode to My Foods"}</button>
          {myFoodNotice&&<p role="status" aria-live="polite" className={`rounded-lg border px-3 py-2 text-sm font-semibold ${myFoodNotice.startsWith("Saved to My Foods!")?"border-emerald-300 bg-emerald-50 text-emerald-800":"border-rose-300 bg-rose-50 text-rose-800"}`}>{myFoodNotice}</p>}
          <p className="text-xs text-slate-600">A barcode and measured serving weight in grams are required to remember a product. User-reviewed values are private to your account.</p>
        </div>}
      </form>}
    </section>
    {!selected&&textAiNotice&&<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{textAiNotice}</p>}
    {selected&&<section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Review nutrition</h2>{fromMyFoods&&<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">From My Foods (your saved values)</span>}</div><p className="text-sm"><strong>{selected.name}</strong> {selected.brand&&`· ${selected.brand}`}</p>
      {textAiOpen&&<BarcodeAiTextAssist
        barcode={barcode}
        initialName={`${selected.name} ${selected.brand}`.trim()}
        initialGrams={grams}
        preferredProvider={chosenBarcodeTextProvider} onDraft={applyTextAiDraft}
      />}
      {textAiNotice&&<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{textAiNotice}</p>}
      {currentCoverage&&<div role="status" className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border px-3 py-3 ${currentCoverage.allKnown?"border-emerald-200 bg-emerald-50":"border-amber-200 bg-amber-50"}`}>
        <div className="min-w-0 flex-1">
          {catalogCoverage?.allKnown ? <>
            <p className="text-sm font-bold text-emerald-900">Nutrition auto-filled from {selected && "nutritionSourceUrl" in selected ? "an exact-barcode community cross-reference" : catalogSource}</p>
            <p className="mt-1 text-xs text-emerald-800">Calories and macros loaded for your selected serving. Review them before saving. No AI credit needed.</p>
          </> : currentCoverage.allKnown ? <>
            <p className="text-sm font-bold text-emerald-900">Nutrition ready to review</p>
            <p className="mt-1 text-xs text-emerald-800">The catalog had missing values, but your edits or AI draft filled them. Check accuracy before saving.</p>
          </> : <>
            <p className="text-sm font-bold text-amber-900">{currentCoverage.anyKnown?"Product has partial nutrition":"Product identified, but nutrition is missing"}</p>
            <p className="mt-1 text-xs leading-5 text-amber-800">Still missing: {currentCoverage.missing.join(", ")}. We only auto-fill values actually present in {catalogSource}. Use Text AI for an approximate draft (1 credit), or enter label values yourself for free.</p>
          </>}
        </div>
        {!currentCoverage.allKnown&&<button type="button" aria-expanded={textAiOpen} aria-controls="barcode-ai-text" onClick={()=>setTextAiOpen(open=>!open)} className="min-h-10 shrink-0 cursor-pointer rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">{textAiOpen?"Close AI helper":"AI fill missing · 1 credit"}</button>}
      </div>}
      {catalogSource === "Khalories Philippine Food Library" && !fromMyFoods && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">Philippine Food Library · Independently reviewed label. Compare with your current package before saving.</p>}
      <p className="text-xs text-slate-600">Nutrition is per 100 g. Serving: {selected.servingDescription||"unknown"}. Package: {selected.packageDescription||"unknown"}. Verify against the actual label.</p>
      <div className="flex flex-wrap gap-2">{choices.map(choice=><button key={choice.label} type="button" onClick={()=>{setGrams(String(choice.grams));setCorrections({});setAnalysis(null);}} aria-pressed={Number(grams)===choice.grams} className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold ${Number(grams)===choice.grams?"border-emerald-500 bg-emerald-50 text-emerald-800":"border-slate-200"}`}>{choice.label}</button>)}</div>
      <label className="block text-sm font-semibold">Actual amount eaten (grams)<input type="number" min="1" max="2000" step="0.1" value={grams} onChange={e=>{setGrams(e.target.value);setCorrections({});setAnalysis(null);}} className="mt-1 block w-36 rounded-lg border border-slate-300 p-3"/></label>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">{fields.map(([label,key,unit])=><label key={key} className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">{label} ({unit})</span><input type="number" step="any" min="0" aria-label={`${label} for selected serving`} value={corrections[key]??portion?.[key]??""} onChange={e=>{setCorrections(v=>({...v,[key]:e.target.value}));setAnalysis(null);}} placeholder="Unknown" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-bold"/></label>)}</div>
      <details className="rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-sm font-semibold">Additional nutrients for this serving</summary><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{advancedFields.map(([label,key,unit])=><label key={key} className="rounded-lg bg-slate-50 p-2 text-xs">{label} ({unit})<input type="number" min="0" step="any" placeholder="Unknown" value={corrections[key]??(portion as Partial<Record<NutritionKey,string>> | null)?.[key]??""} onChange={e=>{setCorrections(v=>({...v,[key]:e.target.value}));setAnalysis(null);}} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"/></label>)}</div></details>
      {"nutritionSourceUrl" in selected && typeof selected.nutritionSourceUrl === "string" && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Nutrition recovered from an exact-barcode community cross-reference (NOT a verified manufacturer label). <a className="underline font-semibold" href={selected.nutritionSourceUrl} target="_blank" rel="noopener noreferrer">Review source</a>. Please compare with your package.
        </p>
      )}
      <div className="k-lf-verify-action">
        <div><strong>✦ Want a second estimate?</strong><p>Text AI can use your product description or pasted nutrition label text to suggest missing values. It does not verify a package; compare the printed label. No credit is used just to open the helper.</p></div>
        <button type="button" onClick={() => { setTextAiOpen(true); requestAnimationFrame(() => document.getElementById("barcode-ai-text")?.scrollIntoView({ behavior: "smooth", block: "start" })); }}>Open Text AI · 1 credit</button>
      </div>
      <p className="text-xs text-slate-600">Unknown values stay blank. Community nutrition can be missing or incorrect. Correct it using your package label before saving.</p>
      {quickLogAnalysis && !analysis && (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-bold text-emerald-950">Ready to log: {Math.round(quickLogAnalysis.totalCalories)} kcal for {grams} g</p>
          <p className="text-xs text-emerald-900">Review the product variant and serving against your pack, then add the food directlyâ€”no AI credit.</p>
          <p className="text-xs font-semibold text-emerald-800">Your meal has not been saved yet. Review it below to continue.</p>
        </div>
      )}
      {!analysis && <button type="button" onClick={preview} className="min-h-11 w-full cursor-pointer rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white transition hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600">Review nutrition &amp; continue to save</button>}
      {analysis&&<div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm font-semibold text-emerald-950">Review complete: {Math.round(analysis.totalCalories)} kcal</p><AddMealButton analysis={analysis}/>
        <button type="button" disabled={savingMyFood} onClick={()=>void rememberFood("selected")} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-5 py-3 text-sm font-extrabold text-white shadow-md shadow-emerald-900/20 transition hover:border-emerald-800 hover:bg-emerald-800 hover:shadow-lg active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"><span aria-hidden="true">💾</span>{savingMyFood?"Saving...":fromMyFoods?"Update My Foods":"Save reviewed nutrition to My Foods"}</button>
        {myFoodNotice&&<p role="status" aria-live="polite" className={`rounded-lg border px-3 py-2 text-sm font-semibold ${myFoodNotice.startsWith("Saved to My Foods!")?"border-emerald-300 bg-emerald-50 text-emerald-800":"border-rose-300 bg-rose-50 text-rose-800"}`}>{myFoodNotice}</p>}
        <p className="text-xs text-slate-600">Your edits are saved privately per barcode and take priority next time. Saving or updating My Foods does not use AI credits.</p>
      </div>}
    </section>}
    <p className="text-xs text-slate-500">Product data by <a className="underline" href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">Open Food Facts</a> under the ODbL. This site is not affiliated with Open Food Facts. Database entries may change. Camera decoding happens locally in the browser; the barcode number is sent to our authenticated server for lookup. No barcode alone can reveal nutrition without a matching record.</p>
  </div>;
}
