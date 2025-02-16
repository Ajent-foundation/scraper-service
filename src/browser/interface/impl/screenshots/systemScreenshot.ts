import axios from "axios"

export interface IBody {
    url: string;
}

export default async function execute(body: IBody) {
    const response = await axios.post(`${body.url}/system/screenshot`, {})
    // Split by first , and return 2nd part
    const img = response.data.image.split(",")[1]
    return {
        img: img,
    }
}
