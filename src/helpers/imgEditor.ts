import UTILITY from './utility'
import { v4 as uuidv4 } from 'uuid'

// thickness -1: fill
export type Color = [number, number, number]
export enum DrawAction {
  Box = "Box",
  Line = "Line",
  Circle = "Circle",
  Text = "Text",
}

export type DrawTextCommand = {
  type: DrawAction.Text
  x: number
  y: number
  text: string
  fontSize: number
  color: Color
}

export type DrawCircleCommand = {
  type: DrawAction.Circle
  x: number
  y: number
  radius: number
  thickness: number
  color: Color
}

export type DrawLineCommand = {
  type: DrawAction.Line
  x1: number
  y1: number
  x2: number
  y2: number
  thickness: number
  color: Color
  isSolid: boolean
}

export type DrawBoxCommand = {
  type: DrawAction.Box
  x: number
  y: number
  width: number
  height: number
  thickness: number
  color: Color
}

export type DrawCommand = DrawTextCommand | DrawCircleCommand | DrawLineCommand | DrawBoxCommand

async function drawOnImage(pageImg:string, commands:DrawCommand[]=[], deleteImg:boolean=true){
  //  generateId
  let id = uuidv4()
  let imgFilePath = `./src/generated/imgs/${id}.png`
  let commandsFilePath = `./src/generated/imgs/${id}.json`

  // Temp save image
  const fs = require("fs")
  fs.writeFileSync(imgFilePath, Buffer.from(pageImg, "base64"))
  fs.writeFileSync(commandsFilePath, JSON.stringify({commands}) )
  
  let newImg: any
  try{
    let res = await UTILITY.FILE.exePythonScript("./draw.py", [imgFilePath, commandsFilePath]) 
    // read file  as base64
    newImg = fs.readFileSync(res["updatedImg"], { encoding: "base64" })
  } catch (err) {
    newImg = -1
  }

  // Delete temp image
  if (deleteImg) fs.unlinkSync(imgFilePath)
  fs.unlinkSync(commandsFilePath)

  return newImg
}

export default drawOnImage