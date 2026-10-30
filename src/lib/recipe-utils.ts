import {z} from "zod";
import {foodAnalysisSchema,type FoodAnalysis} from "@/lib/food-analysis";
import {makeManualFoodAnalysis,type ManualFoodInput} from "@/lib/manual-food";
const schema=z.object({title:z.string().trim().min(2).max(120),servings:z.number().int().min(1).max(100),
  ingredients:z.array(z.object({name:z.string().min(1).max(120),grams:z.string().max(15),calories:z.string().max(15),protein:z.string().max(15),carbs:z.string().max(15),fat:z.string().max(15)}).strict()).min(1).max(20)}).strict();
/** Ingredients describe the whole recipe; each saved template is exactly one serving. */
export function recipeOneServing(input:unknown):{title:string;analysis:FoodAnalysis}{
  const parsed=schema.parse(input);
  // Manual food builder currently supports 10 ingredients per meal. Extra ingredients must be consolidated.
  if(parsed.ingredients.length>10)throw new Error("Use up to 10 ingredients per recipe.");
  const whole=makeManualFoodAnalysis(parsed.ingredients as ManualFoodInput[]);
  const scaled=whole.foods.map(food=>({...food,estimatedGrams:Math.round(food.estimatedGrams/parsed.servings*10)/10,
    calories:Math.round(food.calories/parsed.servings*10)/10,
    protein:Math.round(food.protein/parsed.servings*10)/10,carbs:Math.round(food.carbs/parsed.servings*10)/10,fat:Math.round(food.fat/parsed.servings*10)/10}));
  return {title:parsed.title,analysis:foodAnalysisSchema.parse({...whole,foods:scaled,totalCalories:scaled.reduce((s,f)=>s+f.calories,0),notes:`Recipe: ${parsed.title}. One of ${parsed.servings} servings. Values from user-entered ingredients; verify before logging.`})};
}
