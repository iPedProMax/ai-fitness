"use client";
import {useEffect,useRef,useState,type FormEvent} from "react";
import {AddMealButton} from "@/components/add-meal-button";
import {makeManualFoodAnalysis,type ManualFoodInput} from "@/lib/manual-food";
import {nutritionForGrams,type CatalogFood,validBarcode} from "@/lib/open-food-facts";
import {readCatalogCache,saveCatalogCache} from "@/lib/barcode-cache";
import {suggestedServings} from "@/lib/serving-options";
import {validateBarcodeImageFile} from "@/lib/barcode-image";
import {findMyBarcodeFood,saveMyBarcodeFood} from "@/app/barcode/actions";
import {personalFoodFromServing} from "@/lib/personal-barcode-food";
import {analyzeFood} from "@/lib/analyze-food";
import {AiProviderPicker,type AiProviderChoice} from "@/components/ai-provider-picker";
import {getProviderMaxImages} from "@/lib/ai/provider-image-limits";
import type {FoodAnalysis} from "@/lib/food-analysis";

type NutritionKey="calories"|"protein"|"carbs"|"fat";
const fields= [["Calories","calories","kcal"],["Protein","protein","g"],["Carbs","carbs","g"],["Fat","fat","g"]] as const;
const emptyManual:ManualFoodInput={name:"",grams:"",calories:"",protein:"",carbs:"",fat:""};
export function BarcodeLookup(){
  const [barcode,setBarcode]=useState("");const [search,setSearch]=useState("");
  const [foods,setFoods]=useState<CatalogFood[]>([]);const [selected,setSelected]=useState<CatalogFood|null>(null);
  const [grams,setGrams]=useState("100");const [analysis,setAnalysis]=useState<FoodAnalysis|null>(null);
  const [corrections,setCorrections]=useState<Partial<Record<NutritionKey,string>>>({});
  const [busy,setBusy]=useState(false);const [scanning,setScanning]=useState(false);
  const [message,setMessage]=useState("");const [noResult,setNoResult]=useState(false);
  const [cachedAt,setCachedAt]=useState<number|null>(null);
  const [manualOpen,setManualOpen]=useState(false);
  const [fromMyFoods,setFromMyFoods]=useState(false);
  const [myFoodNotice,setMyFoodNotice]=useState("");
  const [savingMyFood,setSavingMyFood]=useState(false);
  const [aiPanelOpen,setAiPanelOpen]=useState(false);
  const [aiProvider,setAiProvider]=useState<AiProviderChoice>("gemini");
  const [labelPhotos,setLabelPhotos]=useState<File[]>([]);
  const [analyzingLabel,setAnalyzingLabel]=useState(false);
  const [labelNotice,setLabelNotice]=useState("");
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

  async function lookup(type:"barcode"|"q",value:string){
    if(lookupLock.current)return;
    lookupLock.current=true;setBusy(true);setMessage("");setNoResult(false);
    setSelected(null);setAnalysis(null);setManualAnalysis(null);setFoods([]);setCachedAt(null);
    setFromMyFoods(false);setMyFoodNotice("");setAiSuggested(false);setLabelNotice("");
    try{
      // Personal barcode entries take priority over community data and device cache.
      if(type==="barcode"){
        const own=await findMyBarcodeFood(value);
        if(own.status==="found"){
          setFoods([own.food]);choose(own.food,true);return;
        }
        if(own.status==="error")setMyFoodNotice(own.message);
      }
      const cached=readCatalogCache(type,value);
      if(cached){
        setFoods(cached.foods);setCachedAt(cached.fetchedAt);
        if(cached.foods.length===1)choose(cached.foods[0]);
        return;
      }
      const response=await fetch(`/api/food/catalog?${type}=${encodeURIComponent(value)}`,{cache:"no-store"});
      const data:unknown=await response.json();
      const result=data&&typeof data==="object"?data as Record<string,unknown>:{};
      if(!response.ok)throw new Error(typeof result.error==="string"?result.error:"Food lookup unavailable.");
      const matches=Array.isArray(result.foods)?result.foods as CatalogFood[]:[];
      setFoods(matches);
      if(matches.length===1)choose(matches[0]);
      if(matches.length===0){setNoResult(true);setMessage("Product not found in Open Food Facts. Try manual entry or analyze photos of the package and label.");}
      else saveCatalogCache(type,value,matches);
    }catch(issue){setNoResult(true);setMessage(issue instanceof Error?issue.message:"Lookup unavailable.");}
    finally{lookupLock.current=false;setBusy(false);}
  }


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
    setSelected(food);setFromMyFoods(personal);
    setGrams(String(suggestedServings(food)[0]?.grams??100));
    setCorrections({});setAnalysis(null);setMessage("");setManualOpen(false);setAiSuggested(false);
  }
  function preview(){
    if(!selected)return;
    try{
      const input={...nutritionForGrams(selected,Number(grams)),...corrections};
      const basic=makeManualFoodAnalysis([input]);
      setAnalysis({...basic,notes:fromMyFoods?`My Foods user-reviewed nutrition for barcode ${selected.barcode}; not independently verified.`:`Open Food Facts community-contributed nutrition, barcode ${selected.barcode}; serving reviewed by user. Product data: ODbL, openfoodfacts.org.`});setMessage("");
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
    }catch(error){setMyFoodNotice(error instanceof Error?error.message:"Check your nutrition and serving weight.");return;}
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

  function addLabelPhotos(incoming:File[]){
    const count=getProviderMaxImages(aiProvider);
    if(incoming.length+labelPhotos.length>count){setLabelNotice(`This provider supports up to ${count} photo(s). Remove extras or select another provider.`);return;}
    for(const file of incoming){const invalid=validateBarcodeImageFile(file);if(invalid){setLabelNotice(invalid);return;}}
    setLabelPhotos(old=>[...old,...incoming]);setLabelNotice("");
  }

  async function analyzeLabelPhotos(){
    if(analyzingLabel||labelPhotos.length===0)return;
    const limit=getProviderMaxImages(aiProvider);
    if(limit===0||labelPhotos.length>limit){setLabelNotice("This provider cannot accept the selected photos. Change providers or remove images.");return;}
    if(!window.confirm("This calls your selected AI provider and uses ONE of your daily meal-analysis credits. Continue?"))return;
    setAnalyzingLabel(true);setLabelNotice("");
    try{
      const name=selected?.name||manualValues.name||"packaged food";
      const brand=selected?.brand||"";
      // Reuse the EXISTING authenticated, quota-controlled photo analysis route.
      // A barcode number alone does not establish nutrition information.
      const result=await analyzeFood({images:labelPhotos,description:`Packaged ${name} ${brand}. Barcode ${barcode}. Use visible nutrition label and portion, don't invent missing values.`.slice(0,390)},{modelId:aiProvider});
      if(result.foods.length!==1){setLabelNotice("AI returned multiple foods or no food. Try a clear label photo for just one product, or enter the label manually.");return;}
      const suggested=result.foods[0];
      const suggestedGrams=suggested.estimatedGrams>0&&suggested.estimatedGrams<=2000?suggested.estimatedGrams:null;
      const asString=(key:NutritionKey)=>{
        const macroUnknown=key!=="calories"&&suggested.unknownMacros?.includes(key);
        return macroUnknown?"":String(suggested[key]);
      };
      if(selected){
        // The AI suggestion is a REVIEW DRAFT, never saved automatically.
        if(suggestedGrams!==null)setGrams(String(suggestedGrams));
        setCorrections({calories:asString("calories"),protein:asString("protein"),carbs:asString("carbs"),fat:asString("fat")});
        setAnalysis(null);
      }else{
        setManualValues({
          name: suggested.name.trim().slice(0,120)||name,
          grams:suggestedGrams===null?"":String(suggestedGrams),
          calories:asString("calories"),protein:asString("protein"),carbs:asString("carbs"),fat:asString("fat"),
        });
        setManualOpen(true);setManualAnalysis(null);
      }
      setAiSuggested(true);
      setAiPanelOpen(false);
      setLabelNotice(suggestedGrams===null
        ?"AI drafted nutrition values but couldn't establish the serving weight. Enter the label's actual grams before saving or adjusting portions. Verify everything against your package."
        :"AI suggestions filled the review form. Check serving size and each value against the printed nutrition label before you save.");
    }catch(error){setLabelNotice(error instanceof Error?error.message:"AI label analysis is unavailable. Manual entry remains free.");}
    finally{setAnalyzingLabel(false);}
  }

  function manualPreview(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    try{
      const basic=makeManualFoodAnalysis([manualValues]);
      setManualAnalysis({...basic,notes:"User-entered nutrition for a product not found in Open Food Facts. Values were not AI-verified."});setMessage("");
    }catch(issue){setManualAnalysis(null);setMessage(issue instanceof Error?issue.message:"Check nutrition values.");}
  }
  const portion=selected?nutritionForGrams(selected,Number(grams)>0&&Number(grams)<=2000?Number(grams):100):null;
  const choices=selected?suggestedServings(selected):[];
  return <div className="space-y-6">
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold">Scan a food barcode</h2>
      <p className="text-sm text-slate-600">No AI credits for barcode lookups. For products in Open Food Facts, review the nutrition label before saving.</p>
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
      <form onSubmit={e=>{e.preventDefault();stopCamera();void lookup("q",search.trim());}} className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <label className="min-w-48 flex-1 text-sm font-semibold">Or search food products<input value={search} onChange={e=>setSearch(e.target.value)} maxLength={60} placeholder="e.g. canned tuna" className="mt-1 w-full rounded-lg border border-slate-300 p-3"/></label>
        <button type="submit" disabled={search.trim().length<3||busy||decodingImage} className="self-end cursor-pointer rounded-lg border border-slate-300 px-4 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50">Search</button>
      </form>
      {busy&&<p role="status" className="text-sm text-slate-500">Searching the product database...</p>}
      {cachedAt!==null&&<p className="text-xs text-slate-500">Loaded from this device's saved product cache (up to 24 hours old). Check packaging for updates.</p>}
      {message&&<p role="status" className="text-sm text-amber-800">{message}</p>}
      {myFoodNotice&&!analysis&&!manualAnalysis&&<p role="status" aria-live="polite" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-800">{myFoodNotice}</p>}
      {foods.length>1&&<div className="space-y-2"><h3 className="font-semibold">Choose the correct product</h3>{foods.map(food=><button key={food.barcode} type="button" onClick={()=>choose(food)} className="block w-full cursor-pointer rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-400"><strong>{food.name}</strong><span className="block text-xs text-slate-500">{food.brand} · {food.barcode}</span></button>)}</div>}
      {(noResult||foods.length>0)&&<div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={()=>{
          setManualOpen(v=>!v);setManualAnalysis(null);
          if(!manualOpen&&selected)setManualValues({...nutritionForGrams(selected,Number(grams)),name:selected.name});
        }} className="cursor-pointer rounded-xl border border-emerald-300 px-4 py-3 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">{manualOpen?"Hide manual entry":"Enter nutrition manually — free"}</button>
        <button type="button" onClick={()=>setAiPanelOpen(v=>!v)} className="cursor-pointer rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">{aiPanelOpen?"Hide label AI":"Analyze packaging / nutrition label (1 AI credit)"}</button>
      </div>}
      {manualOpen&&<form onSubmit={manualPreview} className="space-y-3 rounded-xl bg-slate-50 p-4" aria-label="Manual packaged food entry">
        <p className="text-sm font-semibold">Copy the values from the package label</p>
        <label className="block text-sm">Product name<input required value={manualValues.name} onChange={e=>{setManualValues(v=>({...v,name:e.target.value}));setManualAnalysis(null);}} maxLength={120} className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3" placeholder="e.g. canned tuna"/></label>
        <label className="block text-sm">Amount eaten in grams (optional)<input value={manualValues.grams} onChange={e=>{setManualValues(v=>({...v,grams:e.target.value}));setManualAnalysis(null);}} type="number" min="0" max="2000" step="any" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3"/></label>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{fields.map(([label,key,unit])=><label key={key} className="text-xs font-medium">{label} ({unit})<input type="number" step="any" min="0" value={manualValues[key]} onChange={e=>{setManualValues(v=>({...v,[key]:e.target.value}));setManualAnalysis(null);}} placeholder="Unknown" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2"/></label>)}</div>
        <p className="text-xs text-slate-600">Enter the values for the amount you ate, not the package's per-100 g numbers unless you ate 100 g. Calories are required unless all three macros are known.</p>
        <button type="submit" className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white">Review manual food</button>
        {manualAnalysis&&<div className="space-y-2"><strong>{Math.round(manualAnalysis.totalCalories)} kcal</strong><AddMealButton analysis={manualAnalysis}/>
          <button type="button" disabled={savingMyFood} onClick={()=>void rememberFood("manual")} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-5 py-3 text-sm font-extrabold text-white shadow-md shadow-emerald-900/20 transition hover:border-emerald-800 hover:bg-emerald-800 hover:shadow-lg active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"><span aria-hidden="true">💾</span>{savingMyFood?"Saving...":"Save this barcode to My Foods"}</button>
          {myFoodNotice&&<p role="status" aria-live="polite" className={`rounded-lg border px-3 py-2 text-sm font-semibold ${myFoodNotice.startsWith("Saved to My Foods!")?"border-emerald-300 bg-emerald-50 text-emerald-800":"border-rose-300 bg-rose-50 text-rose-800"}`}>{myFoodNotice}</p>}
          <p className="text-xs text-slate-600">A barcode and measured serving weight in grams are required to remember a product. User-reviewed values are private to your account.</p>
        </div>}
      </form>}
    </section>
    {(selected||noResult)&&aiPanelOpen&&<section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" aria-label="AI nutrition label assistant">
      <h2 className="text-lg font-bold">Fill missing nutrition from a label</h2>
      <p className="text-sm text-slate-600">Upload a clear nutrition facts photo and optionally the package front. Only pressing Analyze sends the photos to the selected AI and reserves one daily food-analysis credit. AI suggestions must be checked against the package before saving.</p>
      <AiProviderPicker value={aiProvider} onChange={setAiProvider} photoCount={labelPhotos.length}/>
      <label className="block text-sm font-semibold">Nutrition label images
        <input type="file" multiple accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full cursor-pointer rounded-lg border border-slate-300 p-3"
          onChange={e=>{const files=Array.from(e.target.files??[]);e.target.value="";if(files.length)addLabelPhotos(files);}}/>
      </label>
      {labelPhotos.length>0&&<ul className="space-y-2 text-sm">{labelPhotos.map((file,index)=><li key={`${file.name}-${index}`} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 p-2"><span className="truncate">{file.name}</span><button type="button" className="cursor-pointer font-semibold text-red-700" disabled={analyzingLabel} onClick={()=>setLabelPhotos(files=>files.filter((_,i)=>i!==index))}>Remove</button></li>)}</ul>}
      <button type="button" disabled={analyzingLabel||labelPhotos.length===0||labelPhotos.length>getProviderMaxImages(aiProvider)||getProviderMaxImages(aiProvider)===0}
        onClick={()=>void analyzeLabelPhotos()} className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{analyzingLabel?"Analyzing label...":"Analyze label (1 AI credit)"}</button>
      <p className="text-xs text-slate-600">There is no automatic paid fallback. Without a readable label, use free manual entry instead. The original barcode photo is not included in this AI request.</p>
    </section>}
    {labelNotice&&<p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{labelNotice}</p>}
    {selected&&<section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Review nutrition</h2>{fromMyFoods&&<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">From My Foods (your saved values)</span>}</div><p className="text-sm"><strong>{selected.name}</strong> {selected.brand&&`· ${selected.brand}`}</p>
      <p className="text-xs text-slate-600">Nutrition is per 100 g. Serving: {selected.servingDescription||"unknown"}. Package: {selected.packageDescription||"unknown"}. Verify against the actual label.</p>
      <div className="flex flex-wrap gap-2">{choices.map(choice=><button key={choice.label} type="button" onClick={()=>{setGrams(String(choice.grams));setCorrections({});setAnalysis(null);}} aria-pressed={Number(grams)===choice.grams} className={`cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold ${Number(grams)===choice.grams?"border-emerald-500 bg-emerald-50 text-emerald-800":"border-slate-200"}`}>{choice.label}</button>)}</div>
      <label className="block text-sm font-semibold">Actual amount eaten (grams)<input type="number" min="1" max="2000" step="0.1" value={grams} onChange={e=>{setGrams(e.target.value);setCorrections({});setAnalysis(null);}} className="mt-1 block w-36 rounded-lg border border-slate-300 p-3"/></label>
      <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">{fields.map(([label,key,unit])=><label key={key} className="rounded-xl bg-slate-50 p-3"><span className="block text-xs text-slate-500">{label} ({unit})</span><input type="number" step="any" min="0" aria-label={`${label} for selected serving`} value={corrections[key]??portion?.[key]??""} onChange={e=>{setCorrections(v=>({...v,[key]:e.target.value}));setAnalysis(null);}} placeholder="Unknown" className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 font-bold"/></label>)}</div>
      <p className="text-xs text-slate-600">Unknown values stay blank. Community nutrition can be missing or incorrect. Correct it using your package label before saving.</p>
      <button type="button" onClick={preview} className="cursor-pointer rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white">Review meal for saving</button>
      {analysis&&<div className="space-y-2 rounded-xl bg-emerald-50 p-4"><p className="text-sm font-semibold">Ready: {Math.round(analysis.totalCalories)} kcal</p><AddMealButton analysis={analysis}/>
        <button type="button" disabled={savingMyFood} onClick={()=>void rememberFood("selected")} className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-emerald-700 bg-emerald-700 px-5 py-3 text-sm font-extrabold text-white shadow-md shadow-emerald-900/20 transition hover:border-emerald-800 hover:bg-emerald-800 hover:shadow-lg active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"><span aria-hidden="true">💾</span>{savingMyFood?"Saving...":fromMyFoods?"Update My Foods":"Save reviewed nutrition to My Foods"}</button>
        {myFoodNotice&&<p role="status" aria-live="polite" className={`rounded-lg border px-3 py-2 text-sm font-semibold ${myFoodNotice.startsWith("Saved to My Foods!")?"border-emerald-300 bg-emerald-50 text-emerald-800":"border-rose-300 bg-rose-50 text-rose-800"}`}>{myFoodNotice}</p>}
        <p className="text-xs text-slate-600">Your edits are saved privately per barcode and take priority next time. Saving or updating My Foods does not use AI credits.</p>
      </div>}
    </section>}
    <p className="text-xs text-slate-500">Product data by <a className="underline" href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer">Open Food Facts</a> under the ODbL. This site is not affiliated with Open Food Facts. Database entries may change. Camera decoding happens locally in the browser; the barcode number is sent to our authenticated server for lookup. No barcode alone can reveal nutrition without a matching record.</p>
  </div>;
}
