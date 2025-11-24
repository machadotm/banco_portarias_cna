'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@supabase/supabase-js'

// Configuração do Supabase
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Lista de todas as colunas disponíveis para a nova tabela
const todasColunas = [
  { id: 'ano', nome: 'Ano' },
  { id: 'portaria', nome: 'Portaria' },  
  { id: 'anexo', nome: 'Anexo' },
  { id: 'autorizacao', nome: 'Autorização' },
  { id: 'tipo', nome: 'Tipo' },
  { id: 'processo', nome: 'Processo' },
  { id: 'unidade', nome: 'Unidade IPHAN' },
  { id: 'natureza', nome: 'Natureza da Portaria' },  
  { id: 'nivel_in', nome: 'Nível IN' },
  { id: 'empreendedor', nome: 'Empreendedor' },
  { id: 'empreendimento', nome: 'Empreendimento' },
  { id: 'tipo_empreendimento', nome: 'Tipo de Empreendimento' },
  { id: 'projeto', nome: 'Projeto' },  
  { id: 'coordenador_geral', nome: 'Arqueólogos Coordenadores' },
  { id: 'coordenador_campo', nome: 'Arqueólogos de Campo' },
  { id: 'apoios_institucionais', nome: 'Apoio Institucional' },
  { id: 'uf', nome: 'UF da Instituição' },
  { id: 'nome_atual_instituicao', nome: 'Nome Atual da Instituição' },
  { id: 'responsavel', nome: 'Responsável pela Instituição' },
  { id: 'endosso_na_uf', nome: 'Endosso na UF' },
  { id: 'municipios', nome: 'Municípios' },
  { id: 'estados', nome: 'Estados' },
  { id: 'outorga', nome: 'Data da Outorga no DOU' },
  { id: 'prazo', nome: 'Prazo de Validade' },
  { id: 'validade', nome: 'Data de Expiração' },  
]

// COLUNAS HOME - DEFINIDA ANTES DO COMPONENTE
const colunasHome = [
  'ano',
  'portaria',
  'processo',
  'unidade',
  'coordenador_geral',
  'coordenador_campo',
  'outorga',
  'prazo',
  'validade',
  'tipo',
  'status_portaria'
]

// Colunas para busca
const colunasBusca = [
  'ano',
  'portaria',
  'processo',
  'unidade',
  'projeto',
  'empreendedor',
  'empreendimento',
  'tipo_empreendimento',
  'natureza',
  'coordenador_geral',
  'coordenador_campo',
  'apoios_institucionais',
  'municipios',
  'estados',
  'outorga',
  'validade',
  'tipo'
]

// Função para remover acentos e caracteres especiais
const normalizarTexto = (texto: string): string => {
  if (!texto) return ''
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

// Função para calcular status
const calcularStatus = (portaria: any) => {
  if (portaria.tipo && normalizarTexto(portaria.tipo).includes('revogacao')) {
    return 'Revogada'
  }
  const validade = portaria.validade
  if (!validade || validade.trim() === '') return 'Data não informada'
  const regexData = /^(\d{2})\/(\d{2})\/(\d{4})$/
  const match = validade.match(regexData)
  if (!match) return 'Formato inválido'
  const dia = parseInt(match[1])
  const mes = parseInt(match[2]) - 1
  const ano = parseInt(match[3])
  const dataValidade = new Date(ano, mes, dia)
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  return dataValidade > hoje ? 'Vigente' : 'Expirada'
}

// 🔒 Exportar para CSV
const exportarParaCSV = (dados: any[], colunasSelecionadas: string[], todasColunas: any[], nomeArquivo: string = `portarias_cna_${new Date().toISOString().split('T')[0]}.csv`) => {
  if (dados.length === 0) {
    alert('Não há dados para exportar.')
    return
  }
  const colunasOrdenadas: string[] = [];
  if (colunasSelecionadas.includes('status_portaria')) {
    colunasOrdenadas.push('status_portaria');
  }
  todasColunas.forEach(coluna => {
    if (colunasSelecionadas.includes(coluna.id) && coluna.id !== 'status_portaria') {
      colunasOrdenadas.push(coluna.id);
    }
  });
  const headers = colunasOrdenadas.map(colunaId => {
    if (colunaId === 'status_portaria') return 'Status'
    const coluna = todasColunas.find(c => c.id === colunaId)
    return coluna ? coluna.nome : colunaId
  })
  const linhas = dados.map(portaria => {
    return colunasOrdenadas.map(colunaId => {
      if (colunaId === 'status_portaria') {
        return calcularStatus(portaria)
      }
      return `"${(portaria[colunaId] || 'N/A').toString().replace(/"/g, '""')}"`
    }).join(',')
  })
  const csvContent = [headers.join(','), ...linhas].join('\n')
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', nomeArquivo)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

// Paginação estável: use a chave primária da tabela (ajuste se não for 'id')
const PRIMARY_KEY = 'id'

// Buscar todos os dados com paginação estável (sem pular registros)
const buscarTodosDados = async (): Promise<any[]> => {
  const chunkSize = 1000
  let start = 0
  let todos: any[] = []
  let total: number | null = null

  try {
    while (true) {
      const { data, count, error } = await supabase
        .from('banco_portarias_cna')
        .select('*', { count: 'exact' })
        .order(PRIMARY_KEY, { ascending: true })
        .range(start, start + chunkSize - 1)

      if (error) {
        console.error('Erro ao buscar dados:', error)
        break
      }

      if (total == null) total = count ?? null

      if (!data || data.length === 0) break

      todos = todos.concat(data)
      start += chunkSize

      if (total != null && todos.length >= total) break
      if (data.length < chunkSize) break
    }

    console.log(`Total de registros carregados: ${todos.length}`)
    return todos
  } catch (err) {
    console.error('Erro na busca paginada:', err)
    return []
  }
}

// Busca no servidor por termo, cobrindo todas as colunas relevantes, com paginação estável
const buscarPorTermoNoServidor = async (termo: string): Promise<any[]> => {
  const chunkSize = 1000
  let start = 0
  let todos: any[] = []
  let total: number | null = null

  const pattern = `%${termo}%`
  // Monta expressão OR com ILIKE para todas as colunas de colunasBusca
  const orExpr = colunasBusca
    .map((col) => `${col}.ilike.${pattern}`)
    .join(',')

  try {
    while (true) {
      const { data, count, error } = await supabase
        .from('banco_portarias_cna')
        .select('*', { count: 'exact' })
        .or(orExpr)
        .order(PRIMARY_KEY, { ascending: true })
        .range(start, start + chunkSize - 1)

      if (error) {
        console.error('Erro ao buscar por termo:', error)
        break
      }

      if (total == null) total = count ?? null

      if (!data || data.length === 0) break

      todos = todos.concat(data)
      start += chunkSize

      if (total != null && todos.length >= total) break
      if (data.length < chunkSize) break
    }

    return todos
  } catch (err) {
    console.error('Erro na busca por termo:', err)
    return []
  }
}

export default function ConsultaPortarias() {
  const [portarias, setPortarias] = useState<any[]>([])
  const [todosRegistros, setTodosRegistros] = useState<any[]>([])
  const [dadosFiltrados, setDadosFiltrados] = useState<any[]>([])
  const [dadosExibicao, setDadosExibicao] = useState<any[]>([])
  const [termoBuscaInput, setTermoBuscaInput] = useState('')
  const [buscaAplicada, setBuscaAplicada] = useState('')
  const [colunasSelecionadas, setColunasSelecionadas] = useState(colunasHome)
  const [carregando, setCarregando] = useState(true)
  const [dataAtualizacao, setDataAtualizacao] = useState<string>('')
  const [paginaAtual, setPaginaAtual] = useState(1)
  const [itensPorPagina] = useState(100)
  const [totalPaginas, setTotalPaginas] = useState(1)
  const [totalRegistros, setTotalRegistros] = useState(0)

  const [filtroAno, setFiltroAno] = useState<string>('')
  const [filtroUnidade, setFiltroUnidade] = useState<string>('')
  const [filtroTipoEmpreendimento, setFiltroTipoEmpreendimento] = useState<string>('')
  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const [filtroStatus, setFiltroStatus] = useState<string>('')

  const [isClient, setIsClient] = useState(false)
  const [resultadosBuscaServidor, setResultadosBuscaServidor] = useState<any[] | null>(null)
  const [carregandoBusca, setCarregandoBusca] = useState(false)

  const bodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsClient(true)
  }, [])

  // Carregar todos os dados com paginação estável
  useEffect(() => {
    const buscarDados = async () => {
      try {
        setCarregando(true)
        const todosDados = await buscarTodosDados()
        setPortarias(todosDados)
        setTodosRegistros(todosDados)
        setTotalRegistros(todosDados.length)

        // Última atualização
        const { data: dataAtualizacao, error: errorAtualizacao } = await supabase
          .from('banco_portarias_cna')
          .select('updated_at')
          .order('updated_at', { ascending: false })
          .limit(1)

        if (!errorAtualizacao && dataAtualizacao && dataAtualizacao.length > 0) {
          const dataUTC = new Date(dataAtualizacao[0].updated_at)
          const dataBrasilia = new Date(dataUTC.getTime() - 3 * 60 * 60 * 1000)
          const dia = dataBrasilia.getUTCDate().toString().padStart(2, '0')
          const mes = (dataBrasilia.getUTCMonth() + 1).toString().padStart(2, '0')
          const ano = dataBrasilia.getUTCFullYear()
          setDataAtualizacao(`${dia}/${mes}/${ano}`)
        }
      } catch (err) {
        console.error('Erro ao carregar dados:', err)
      } finally {
        setCarregando(false)
      }
    }
    buscarDados()
  }, [])

  // Exibição inicial
  useEffect(() => {
    if (portarias.length === 0) return
    const registrosRecentes = portarias
      .slice() // evita sort in-place
      .sort((a, b) => {
        if (a.ano !== b.ano) return b.ano - a.ano
        return (b.portaria || '').localeCompare(a.portaria || '')
      })
      .slice(0, 100)

    setDadosFiltrados(registrosRecentes)
    setDadosExibicao(registrosRecentes)
    setPaginaAtual(1)
    setTotalPaginas(Math.ceil(portarias.length / itensPorPagina))
  }, [portarias, itensPorPagina])

  // Busca no servidor quando o termo é aplicado
  useEffect(() => {
    const executarBuscaServidor = async () => {
      if (!buscaAplicada.trim()) {
        setResultadosBuscaServidor(null)
        return
      }
      try {
        setCarregandoBusca(true)
        const resultados = await buscarPorTermoNoServidor(buscaAplicada.trim())
        setResultadosBuscaServidor(resultados)
      } catch (err) {
        console.error('Erro na busca servidor:', err)
        setResultadosBuscaServidor([])
      } finally {
        setCarregandoBusca(false)
      }
    }
    executarBuscaServidor()
  }, [buscaAplicada])

  // Aplicar filtros sobre a base atual (resultados da busca servidor ou todos registros)
  const obterDadosBaseParaFiltros = useCallback(() => {
    return resultadosBuscaServidor ?? todosRegistros
  }, [resultadosBuscaServidor, todosRegistros])

  const obterDadosFiltrados = useCallback((dados: any[]) => {
    let resultados = dados

    if (filtroAno) {
      resultados = resultados.filter(portaria => 
        portaria.ano?.toString() === filtroAno || 
        (filtroAno === 'NULL' && (portaria.ano === null || portaria.ano === undefined))
      )
    }
    if (filtroUnidade) {
      resultados = resultados.filter(portaria => {
        const valorUnidade = portaria.unidade || ''
        const valorNormalizado = normalizarTexto(valorUnidade)
        const filtroNormalizado = normalizarTexto(filtroUnidade)
        if (filtroUnidade === 'NULL') {
          return !portaria.unidade || portaria.unidade.trim() === ''
        }
        return valorNormalizado.includes(filtroNormalizado)
      })
    }
    if (filtroTipoEmpreendimento) {
      resultados = resultados.filter(portaria => {
        const valorTipo = portaria.tipo_empreendimento || ''
        const valorNormalizado = normalizarTexto(valorTipo)
        const filtroNormalizado = normalizarTexto(filtroTipoEmpreendimento)
        if (filtroTipoEmpreendimento === 'NULL') {
          return !portaria.tipo_empreendimento || portaria.tipo_empreendimento.trim() === ''
        }
        return valorNormalizado.includes(filtroNormalizado)
      })
    }
    if (filtroTipo) {
      resultados = resultados.filter(portaria => {
        const valorTipo = portaria.tipo || ''
        const valorNormalizado = normalizarTexto(valorTipo)
        const filtroNormalizado = normalizarTexto(filtroTipo)
        if (filtroTipo === 'NULL') {
          return !portaria.tipo || portaria.tipo.trim() === ''
        }
        return valorNormalizado.includes(filtroNormalizado)
      })
    }
    if (filtroStatus) {
      resultados = resultados.filter(portaria => calcularStatus(portaria) === filtroStatus)
    }

    return resultados
  }, [filtroAno, filtroUnidade, filtroTipoEmpreendimento, filtroTipo, filtroStatus])

  // Atualiza filtrados quando base/filtros mudam
  useEffect(() => {
    const base = obterDadosBaseParaFiltros()
    const resultados = obterDadosFiltrados(base)
    setDadosFiltrados(resultados)
    setPaginaAtual(1)
    setTotalPaginas(Math.ceil(resultados.length / itensPorPagina))
  }, [resultadosBuscaServidor, todosRegistros, obterDadosBaseParaFiltros, obterDadosFiltrados, itensPorPagina])

  // Paginação de exibição
  useEffect(() => {
    const inicio = (paginaAtual - 1) * itensPorPagina
    const fim = inicio + itensPorPagina
    setDadosExibicao(dadosFiltrados.slice(inicio, fim))
  }, [dadosFiltrados, paginaAtual, itensPorPagina])

  // Ações de busca
  const executarBusca = () => {
    setBuscaAplicada(termoBuscaInput)
    setPaginaAtual(1)
  }
  const limparBusca = () => {
    setTermoBuscaInput('')
    setBuscaAplicada('')
    setResultadosBuscaServidor(null)
    setPaginaAtual(1)
  }
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') executarBusca()
  }

  // Filtros
  const atualizarFiltroAno = (ano: string) => {
    setFiltroAno(ano)
    setFiltroUnidade('')
    setFiltroTipoEmpreendimento('')
    setFiltroTipo('')
    setFiltroStatus('')
  }
  const atualizarFiltroUnidade = (unidade: string) => {
    setFiltroUnidade(unidade)
    setFiltroTipoEmpreendimento('')
    setFiltroTipo('')
    setFiltroStatus('')
  }
  const atualizarFiltroTipoEmpreendimento = (tipoEmpreendimento: string) => {
    setFiltroTipoEmpreendimento(tipoEmpreendimento)
    setFiltroTipo('')
    setFiltroStatus('')
  }
  const atualizarFiltroTipo = (tipo: string) => {
    setFiltroTipo(tipo)
  }
  const atualizarFiltroStatus = (status: string) => {
    setFiltroStatus(status)
  }

  // Opções únicas
  const obterValoresUnicos = useCallback((dados: any[], campo: string) => {
    const valoresProcessados = dados
      .map(item => item[campo])
      .map(valor => !valor || valor.toString().trim() === '' ? 'Não informado' : valor.toString().trim())
    const valoresUnicos = [...new Set(valoresProcessados)]
    const naoInformado = valoresUnicos.filter(v => v === 'Não informado')
    const outros = valoresUnicos.filter(v => v !== 'Não informado').sort()
    return [...naoInformado, ...outros]
  }, [])

  const obterOpcoesFiltro = useCallback(() => {
    const dadosBase = obterDadosBaseParaFiltros()
    const dadosParaAno = obterDadosFiltrados(dadosBase)
    const anos = [...new Set(dadosParaAno.map((item: any) => item.ano).filter((ano: any) => ano != null))].sort((a: number, b: number) => b - a)
    const dadosParaUnidade = obterDadosFiltrados(dadosBase)
    const unidades = obterValoresUnicos(dadosParaUnidade, 'unidade')
    const dadosParaTipoEmpreendimento = obterDadosFiltrados(dadosBase)
    const tiposEmpreendimento = obterValoresUnicos(dadosParaTipoEmpreendimento, 'tipo_empreendimento')
    const dadosParaTipo = obterDadosFiltrados(dadosBase)
    const tipos = obterValoresUnicos(dadosParaTipo, 'tipo')
    return { anos, unidades, tiposEmpreendimento, tipos }
  }, [obterDadosBaseParaFiltros, obterDadosFiltrados, obterValoresUnicos])

  const { anos, unidades, tiposEmpreendimento, tipos } = obterOpcoesFiltro()

  const obterOpcoesStatus = useCallback(() => {
    const dadosBase = obterDadosBaseParaFiltros()
    const dadosParaStatus = obterDadosFiltrados(dadosBase)
    const statusUnicos = [...new Set(dadosParaStatus.map(portaria => calcularStatus(portaria)))].sort()
    return statusUnicos
  }, [obterDadosBaseParaFiltros, obterDadosFiltrados])

  const opcoesStatus = obterOpcoesStatus()

  // Exportação
  const getDadosParaExportar = () => {
    const base = obterDadosBaseParaFiltros()
    if (buscaAplicada && buscaAplicada.trim() !== '') {
      return {
        dados: dadosFiltrados,
        nome: `portarias_busca_${buscaAplicada.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
      }
    }
    if (filtroAno || filtroUnidade || filtroTipoEmpreendimento || filtroTipo || filtroStatus) {
      return {
        dados: dadosFiltrados,
        nome: `portarias_filtradas_${new Date().toISOString().split('T')[0]}.csv`
      }
    }
    return {
      dados: base,
      nome: `portarias_cna_completas_${new Date().toISOString().split('T')[0]}.csv`
    }
  }
  const handleExportarCSV = () => {
    const { dados, nome } = getDadosParaExportar()
    exportarParaCSV(dados, colunasSelecionadas, todasColunas, nome)
  }

  // UI: paginação/colunas
  const irParaPagina = (pagina: number) => setPaginaAtual(pagina)
  const avancarPagina = () => { if (paginaAtual < totalPaginas) setPaginaAtual(paginaAtual + 1) }
  const voltarPagina = () => { if (paginaAtual > 1) setPaginaAtual(paginaAtual - 1) }
  const alternarColuna = (colunaId: string) => {
    if (colunasSelecionadas.includes(colunaId)) {
      setColunasSelecionadas(colunasSelecionadas.filter(c => c !== colunaId))
    } else {
      setColunasSelecionadas([...colunasSelecionadas, colunaId])
    }
  }
  const renderizarConteudoCelula = (valor: string) => {
    if (!valor || valor === 'N/A') return <span className="text-gray-500">N/A</span>
    return valor
  }
  const obterClasseStatus = (status: string) => {
    switch (status) {
      case 'Vigente': return 'bg-green-100 text-green-800'
      case 'Expirada': return 'bg-red-100 text-red-800'
      case 'Revogada': return 'bg-orange-100 text-orange-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }
  const gerarBotoesPagina = () => {
    const botoes = []
    const maxBotoes = 5
    let inicio = Math.max(1, paginaAtual - Math.floor(maxBotoes / 2))
    let fim = Math.min(totalPaginas, inicio + maxBotoes - 1)
    if (fim - inicio + 1 < maxBotoes) inicio = Math.max(1, fim - maxBotoes + 1)
    for (let i = inicio; i <= fim; i++) {
      botoes.push(
        <button
          key={i}
          onClick={() => irParaPagina(i)}
          className={`px-3 py-1 text-sm font-medium rounded-md ${paginaAtual === i ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300'}`}
        >
          {i}
        </button>
      )
    }
    return botoes
  }
  const getColunasOrdenadasParaExibicao = () => {
    const colunasOrdenadas: {id: string, nome: string}[] = [];
    if (colunasSelecionadas.includes('status_portaria')) {
      colunasOrdenadas.push({ id: 'status_portaria', nome: 'Status' });
    }
    todasColunas.forEach(coluna => {
      if (colunasSelecionadas.includes(coluna.id) && coluna.id !== 'status_portaria') {
        colunasOrdenadas.push(coluna);
      }
    });
    return colunasOrdenadas;
  }

  if (carregando || !isClient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando dados...</p>
          <p className="text-sm text-gray-500 mt-2">Isso pode levar alguns segundos</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Consulta de Autorizações de Pesquisas Arqueológicas</h1>
          <p className="text-gray-900">
            Dados extraídos do Banco de Portarias mantido e atualizado pelo{' '}
            <a href="https://www.gov.br/iphan/pt-br/patrimonio-cultural/patrimonio-arqueologico/autorizacoes-de-pesquisas-arqueologicas" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">CNA/IPHAN</a>
            {' '} - {' '}
            <a href="https://docs.google.com/spreadsheets/d/1R5svYhxvBHNOW35NEy23oE8VXX1eWq5v/edit?gid=246705190#gid=246705190" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Ver repositório de dados</a>
          </p>
          <p className="text-gray-800">Informações consultáveis até a Portaria nº 104/2025 - Publicada no DOU em 12/11/2025</p>
          <p className="text-gray-800">
            Para consultar dados de portarias pós 12/11/2025 - {' '}
            <a href="https://consulta-portarias.vercel.app/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 underline">Ver extração DOU</a>
          </p>
          <p className="text-gray-600">Busque e filtre as informações de acordo com suas necessidades</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="🔍 Buscar por nome de arqueólogos, projetos, empreendimentos, processos, estados..."
                  value={termoBuscaInput}
                  onChange={(e) => setTermoBuscaInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                />
                <button
                  onClick={executarBusca}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Buscar
                </button>
                {(termoBuscaInput || buscaAplicada) && (
                  <button
                    onClick={limparBusca}
                    className="px-4 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                A base de dados consultada possui {totalRegistros.toLocaleString()} registros
                {buscaAplicada && (
                  <span className="font-semibold">
                    {' '}- Buscando por: "{buscaAplicada}" {carregandoBusca ? ' (carregando...)' : ''}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Selecione as colunas para visualização dos dados:</h3>
            <div className="flex flex-wrap gap-3">
              {todasColunas.map((coluna) => (
                <label key={coluna.id} className="flex items-center space-x-2 bg-gray-100 px-3 py-2 rounded-lg">
                  <input
                    type="checkbox"
                    checked={colunasSelecionadas.includes(coluna.id)}
                    onChange={() => alternarColuna(coluna.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">{coluna.nome}</span>
                </label>
              ))}
              <label className="flex items-center space-x-2 bg-blue-100 px-3 py-2 rounded-lg">
                <input
                  type="checkbox"
                  checked={colunasSelecionadas.includes('status_portaria')}
                  onChange={() => alternarColuna('status_portaria')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-blue-700">Status</span>
              </label>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Refine o resultado da busca por filtragem:</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
                <select
                  value={filtroAno}
                  onChange={(e) => atualizarFiltroAno(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                >
                  <option value="">Todos</option>
                  {anos.map(ano => (
                    <option key={ano} value={ano}>{ano}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidade</label>
                <select
                  value={filtroUnidade}
                  onChange={(e) => atualizarFiltroUnidade(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                >
                  <option value="">Todas</option>
                  {unidades.map(unidade => (
                    <option key={unidade} value={unidade === 'Não informado' ? 'NULL' : unidade}>
                      {unidade}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Empreendimento</label>
                <select
                  value={filtroTipoEmpreendimento}
                  onChange={(e) => atualizarFiltroTipoEmpreendimento(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                >
                  <option value="">Todos</option>
                  {tiposEmpreendimento.map(tipo => (
                    <option key={tipo} value={tipo === 'Não informado' ? 'NULL' : tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                <select
                  value={filtroTipo}
                  onChange={(e) => atualizarFiltroTipo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                >
                  <option value="">Todos</option>
                  {tipos.map(tipo => (
                    <option key={tipo} value={tipo === 'Não informado' ? 'NULL' : tipo}>
                      {tipo}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filtroStatus}
                  onChange={(e) => atualizarFiltroStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                >
                  <option value="">Todos</option>
                  {opcoesStatus.map(status => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <div 
              ref={bodyRef}
              className="overflow-x-auto"
              style={{ maxHeight: 'calc(100vh - 400px)', overflow: 'auto' }}
            >
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10">
                  <tr>
                    {getColunasOrdenadasParaExibicao().map(coluna => (
                      <th 
                        key={coluna.id} 
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap bg-gray-50"
                        style={{ minWidth: '150px' }}
                      >
                        {coluna.nome}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {dadosExibicao.map((portaria, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      {getColunasOrdenadasParaExibicao().map(coluna => (
                        <td 
                          key={coluna.id} 
                          className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                          style={{ minWidth: '150px' }}
                        >
                          {coluna.id === 'status_portaria' ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${obterClasseStatus(calcularStatus(portaria))}`}>
                              {calcularStatus(portaria)}
                            </span>
                          ) : (
                            renderizarConteudoCelula(portaria[coluna.id] || 'N/A')
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="text-sm text-gray-700">
                <div className="flex items-center gap-4">
                  <span>
                    Página {paginaAtual} de {totalPaginas} {' '}
                    ({dadosExibicao.length} de {dadosFiltrados.length} registros)
                  </span>
                  {totalPaginas > 1 && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={voltarPagina}
                        disabled={paginaAtual === 1}
                        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Anterior
                      </button>
                      <div className="flex gap-1">{gerarBotoesPagina()}</div>
                      <button
                        onClick={avancarPagina}
                        disabled={paginaAtual === totalPaginas}
                        className="px-3 py-1 text-sm bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Próxima
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3">
                {(obterDadosBaseParaFiltros().length > 0) && (
                  <button
                    onClick={handleExportarCSV}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    {(() => {
                      const { dados } = getDadosParaExportar()
                      const quantidade = dados.length
                      if (buscaAplicada && buscaAplicada.trim() !== '') {
                        return `Exportar resultados da busca (${quantidade} registros)`
                      } else if (filtroAno || filtroUnidade || filtroTipoEmpreendimento || filtroTipo || filtroStatus) {
                        return `Exportar resultados filtrados (${quantidade} registros)`
                      } else {
                        return `Exportar todos os dados (${quantidade} registros)`
                      }
                    })()}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center text-gray-500 text-sm">
          <p>Total de registros: {totalRegistros.toLocaleString()}</p>
          <p>Dados de 1991 até 12/11/2025</p>
        </div>
      </div>
    </div>
  )
}
