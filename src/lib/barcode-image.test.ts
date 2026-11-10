import {describe,expect,it} from "vitest";
import {MAX_BARCODE_IMAGE_BYTES,validateBarcodeImageFile} from "./barcode-image";
describe("local barcode image input validation",()=>{
  it.each(["image/jpeg","image/png","image/webp"])("accepts supported photo type %s",type=>{
    expect(validateBarcodeImageFile({type,size:40000})).toBeNull();
  });
  it("rejects empty and over-limit files",()=>{
    expect(validateBarcodeImageFile({type:"image/jpeg",size:0})).toMatch(/empty/);
    expect(validateBarcodeImageFile({type:"image/png",size:MAX_BARCODE_IMAGE_BYTES+1})).toMatch(/10 MB/);
  });
  it("rejects unsupported formats before decoding",()=>{
    for(const type of ["application/pdf","image/gif","image/svg+xml",""]){
      expect(validateBarcodeImageFile({type,size:4000})).toMatch(/JPG/);
    }
  });
});
