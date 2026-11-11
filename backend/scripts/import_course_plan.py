#!/usr/bin/env python3
"""Convert the course-planning Markdown into server-side seed data."""

import json
import re
import sys
from pathlib import Path

OPERATORS = "+−×÷"
EMOJIS = ["➕", "➖", "✖️", "➗", "🌟"]
CHAPTER_SUBTITLES = [
    "Some números e conecte os resultados.",
    "Encontre as diferenças em cada cruzamento.",
    "Use a tabuada para completar as equações.",
    "Divida em partes iguais e descubra os valores.",
    "Combine as quatro operações em uma trilha final.",
]


def clean(text):
    return re.sub(r"\s+", " ", text).strip()


def parse_equation(expression, expected, level_id, equation_number):
    pieces = re.split(r"\s*([+−×÷=])\s*", expression.strip())
    if len(pieces) != 5 or pieces[1] not in OPERATORS or pieces[3] != "=":
        raise ValueError(f"Unsupported equation in level {level_id}: {expression}")

    values = []
    input_id = f"l{level_id:02d}-e{equation_number:02d}"
    answer_key = {}
    for position, token in enumerate((pieces[0], pieces[2], pieces[4])):
        if token == "□":
            values.append({"type": "number", "inputId": input_id})
            answer_key[input_id] = int(expected)
        else:
            values.append({"type": "number", "value": int(token)})

    cells = [values[0], {"type": "operator", "value": pieces[1]}, values[1], {"type": "equals"}, values[2]]
    return cells, answer_key, pieces


def evaluate(operator, left, right):
    return {
        "+": lambda: left + right,
        "−": lambda: left - right,
        "×": lambda: left * right,
        "÷": lambda: left // right if right and left % right == 0 else None,
    }[operator]()


def number_cell(value):
    return {"type": "number", "value": value}


def make_bonus():
    answers = {
        "a": 9, "b": 8, "c": 10, "d": 1, "e": 5, "f": 1, "g": 5,
        "h": 4, "i": 8, "j": 15, "k": 7, "l": 22, "m": 10, "n": 1,
        "p": 10, "q": 12, "r": 6, "s": 18, "t": 4, "u": 22, "v": 22, "w": 29,
    }
    grid = [[None for _ in range(11)] for _ in range(11)]

    def put(x, y, cell):
        grid[y][x] = cell

    def horizontal(y, x, left, operator, right, result):
        put(x, y, left)
        put(x + 1, y, {"type": "operator", "value": operator})
        put(x + 2, y, right)
        put(x + 3, y, {"type": "equals"})
        put(x + 4, y, result)

    def vertical(x, y, top, operator, middle, bottom):
        put(x, y, top)
        put(x, y + 1, {"type": "operator", "value": operator, "isVertical": True})
        put(x, y + 2, middle)
        put(x, y + 3, {"type": "equals", "isVertical": True})
        put(x, y + 4, bottom)

    def input_cell(key):
        return {"type": "number", "inputId": key}

    def fixed(value):
        return number_cell(value)

    horizontal(0, 0, fixed(17), "−", input_cell("a"), input_cell("b"))
    horizontal(0, 6, input_cell("c"), "+", input_cell("d"), fixed(11))
    horizontal(2, 2, input_cell("e"), "÷", input_cell("f"), input_cell("g"))
    horizontal(4, 0, fixed(2), "×", input_cell("h"), input_cell("i"))
    horizontal(4, 6, input_cell("j"), "+", input_cell("k"), input_cell("l"))
    horizontal(6, 0, input_cell("m"), "+", input_cell("n"), fixed(11))
    horizontal(8, 0, input_cell("q"), "+", input_cell("r"), input_cell("s"))
    horizontal(8, 6, fixed(18), "+", input_cell("t"), input_cell("u"))
    horizontal(10, 0, input_cell("v"), "+", fixed(7), input_cell("w"))

    # Vertical bars share the horizontal number cells at their crossings.
    vertical(2, 0, input_cell("a"), "−", input_cell("e"), input_cell("h"))
    vertical(4, 0, input_cell("b"), "×", input_cell("f"), input_cell("i"))
    vertical(6, 0, input_cell("c"), "+", input_cell("g"), input_cell("j"))
    vertical(8, 0, input_cell("d"), "+", fixed(6), input_cell("k"))
    vertical(10, 4, input_cell("l"), "×", fixed(1), input_cell("u"))
    vertical(0, 4, fixed(2), "+", input_cell("m"), input_cell("q"))
    vertical(2, 6, input_cell("n"), "+", input_cell("r"), fixed(7))
    vertical(4, 4, fixed(11), "+", input_cell("s"), input_cell("w"))
    vertical(8, 6, input_cell("p"), "+", input_cell("t"), fixed(14))

    bank = [8, 15, 22, 1, 10, 10, 1, 5, 9, 22, 10, 6, 12, 1, 18, 7, 4, 29, 4, 22, 8, 5]
    return {
        "id": 40,
        "chapter": 5,
        "unit": 3,
        "session": 4,
        "title": "Desafio de referência — Muito difícil",
        "subtitle": "Uma cruzadinha longa com 18 equações interligadas e quatro operadores.",
        "instruction": "Use todas as operações e confira cada cruzamento.",
        "difficulty": "very_hard",
        "xpReward": 50,
        "emoji": "🧠",
        "grid": grid,
        "inputIds": list(answers),
        "bank": bank,
        "answerKey": answers,
        "isBonus": True,
        "source": "imagem de referência enviada pelo usuário",
    }


def main():
    if len(sys.argv) != 3:
        raise SystemExit("usage: import_course_plan.py COURSE_MARKDOWN OUTPUT_JSON")

    source = Path(sys.argv[1]).read_text(encoding="utf-8")
    levels = []
    chapter_id = 0
    unit_id = 0
    unit_title = ""
    unit_description = ""
    current_level = None

    def finish_level():
        nonlocal current_level
        if current_level is None:
            return
        level_id = len(levels) + 1
        rows = []
        answer_key = {}
        source_answers = []
        constants = []
        for number, equation in enumerate(current_level["equations"], start=1):
            row, answer, pieces = parse_equation(equation["expression"], equation["answer"], level_id, number)
            left = int(equation["answer"]) if pieces[0] == "□" else int(pieces[0])
            right = int(equation["answer"]) if pieces[2] == "□" else int(pieces[2])
            result = int(equation["answer"]) if pieces[4] == "□" else int(pieces[4])
            expected_result = evaluate(pieces[1], left, right)
            if expected_result != result:
                raise ValueError(f"Incorrect source answer in level {level_id}: {equation['expression']}")
            rows.append(row)
            answer_key.update(answer)
            source_answers.append((next(iter(answer)), int(equation["answer"])))
            constants.extend(int(part) for part in pieces if part.isdecimal())

        # Consecutive solution cells are linked by a visible addition equation.
        for (left_id, left_value), (right_id, right_value) in zip(source_answers, source_answers[1:]):
            if left_value > right_value:
                left_id, right_id = right_id, left_id
                left_value, right_value = right_value, left_value
            rows.append([
                {"type": "number", "inputId": left_id},
                {"type": "operator", "value": "+"},
                number_cell(right_value - left_value),
                {"type": "equals"},
                {"type": "number", "inputId": right_id},
            ])

        grid = []
        for index, row in enumerate(rows):
            if index:
                grid.append([None] * 5)
            grid.append(row)

        supplied_bank = current_level["bank"]
        if supplied_bank is not None:
            bank = supplied_bank
        else:
            answers = set(answer_key.values())
            distractors = sorted(set(constants) - answers)[:4]
            bank = sorted(answers | set(distractors))

        session = current_level["number"]
        difficulty = current_level["difficulty"] or {1: "easy", 2: "medium", 3: "hard"}[session]
        levels.append({
            "id": level_id,
            "chapter": chapter_id,
            "unit": unit_id,
            "unitTitle": current_level["unitTitle"],
            "session": session,
            "title": current_level["title"],
            "subtitle": unit_description or CHAPTER_SUBTITLES[chapter_id - 1],
            "instruction": current_level["instruction"] or "Complete as equações com os números do banco.",
            "difficulty": difficulty,
            "xpReward": 10 + (chapter_id - 1) * 5 + (session - 1) * 10,
            "emoji": EMOJIS[chapter_id - 1],
            "grid": grid,
            "inputIds": list(answer_key),
            "bank": bank,
            "answerKey": answer_key,
            "isBonus": False,
            "source": f"planejamento_curso_cruzadinhas_matematicas.md — Capítulo {chapter_id}, Unidade {unit_id}, Level {session}",
        })
        current_level = None

    for line in source.splitlines():
        chapter = re.match(r"^#\s+\d+\.\s+Capítulo\s+(\d+)\s+---\s+(.+)$", line)
        unit = re.match(r"^##\s+Unidade\s+(\d+)\s+---\s+(.+)$", line)
        level = re.match(r"^###\s+Level\s+(\d+)\s+---\s+(.+)$", line)
        if chapter:
            finish_level()
            chapter_id = int(chapter.group(1))
            unit_id, unit_title, unit_description = 0, "", ""
            continue
        if unit:
            finish_level()
            unit_id = int(unit.group(1))
            unit_title = clean(unit.group(2))
            unit_description = ""
            continue
        if level:
            finish_level()
            current_level = {
                "number": int(level.group(1)),
                "title": clean(level.group(2)),
                "unitTitle": unit_title,
                "instruction": "",
                "instruction_open": False,
                "difficulty": None,
                "equations": [],
                "bank": None,
            }
            continue
        if current_level is None:
            description = re.match(r'^\*\*Descrição:\*\*\s*"(.+?)"\s*$', line)
            if description:
                unit_description = clean(description.group(1))
            continue

        if current_level["instruction_open"]:
            more = line.strip()
            is_final_line = more.endswith('"')
            current_level["instruction"] = clean(
                f"{current_level['instruction']} {more.rstrip(chr(34)) if is_final_line else more}"
            )
            current_level["instruction_open"] = not is_final_line
        else:
            instruction = re.match(r'^\s*-?\s*\*\*Instrução:\*\*\s*"(.*)$', line)
            if instruction:
                text = instruction.group(1)
                is_final_line = text.endswith('"')
                current_level["instruction"] = clean(text.rstrip('"'))
                current_level["instruction_open"] = not is_final_line
        difficulty = re.match(r"^\s*-?\s*\*\*Dificuldade:\*\*\s*(.+?)\s*\.?$", line)
        if difficulty:
            value = clean(difficulty.group(1)).lower()
            current_level["difficulty"] = "easy" if "fácil" in value else "medium" if "intermediária" in value else "hard"
        bank = re.search(r"\*\*Banco de números:\*\*\s*`([^`]+)`", line)
        if bank:
            current_level["bank"] = [int(value.strip()) for value in bank.group(1).split(",")]
        equation = re.match(r"^\s*(.+?)\s{2,}(\d+)\s*$", line)
        if equation and any(operator in equation.group(1) for operator in OPERATORS):
            current_level["equations"].append({"expression": clean(equation.group(1)), "answer": equation.group(2)})

    finish_level()
    if len(levels) != 39:
        raise ValueError(f"Expected the course plan's 39 levels, parsed {len(levels)}")

    output = {
        "version": 1,
        "course": "Cruzadinhas Matemáticas",
        "source": "planejamento_curso_cruzadinhas_matematicas.md",
        "chapters": [
            {"id": index, "title": title, "description": CHAPTER_SUBTITLES[index - 1]}
            for index, title in enumerate(["Adição", "Subtração", "Multiplicação", "Divisão", "Desafio final"], start=1)
        ],
        "levels": levels,
        "bonus": make_bonus(),
    }
    Path(sys.argv[2]).write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(levels)} course levels and one bonus benchmark")


if __name__ == "__main__":
    main()
