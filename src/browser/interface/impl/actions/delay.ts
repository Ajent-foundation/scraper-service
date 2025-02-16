export interface IBody {
	delay: number;
}

export default async function execute(body: IBody) {
	// Wait for delay
	await (async (delay) =>
		new Promise((resolve) => setTimeout(resolve, delay)))(body.delay);

	return {};
}
